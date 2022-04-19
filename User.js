const debug = require('debug')('users:User')
const bcrypt = require('bcrypt')
const { client, ObjectId } = require('./mongoclient.js')
const Database = 'mattmadethese'
const Collection = 'users'

class User {
	constructor( config ){
		this.objectId = ObjectId
		this.dbClient = client 
		this.dbDatabase = 'mattmadethese'
		this.dbCollection = 'users'
		this._id = config?.id || null
		this._type = config?.type || `User`
		this._first = config?.first_name || null
		this._last = config?.last_name || null
		let full_name;
		if(config.name != null && config.name != '') {
			full_name = config.name
		} else if(this._first != null && this._last != null) {
			full_name = `${this._first} ${this._last}`
		}
		this._name = full_name || null
		this._email = config?.email || ''
		let hashOrPassword
		if(config.hashedPassword != null && config.hashedPassword.match(/^\$2b\$10/)['input'] == config.hashedPassword) {
			hashOrPassword = config.hashedPassword	
		} else if(config.password != null && config.password != '') {
			hashOrPassword = bcrypt.hashSync(config.password, 10)
		}
		this._hashedPassword = hashOrPassword || null
		this._jwts = config?.jwts || null 
		this._created_on = config?.created_on || Date.now()
		this._updated_on = config?.updated_on || null
		this._description = config?.description || 'This is a user.'
	}

		static async findByEmail( email ) {
		let foundUserByEmail
		try {
			await client.connect()
			const db = client.db(Database)
			const users = db.collection(Collection)
			foundUserByEmail = await users.findOne( {email: email })
		} catch (err) {
			debug('Exception during findByEmail')
			throw new Error(err.message)
		} finally {
			await client.close()
		}
		// If no user found by email, returned result is NULL.
		if(foundUserByEmail != null) {
			return new User( {
				id: foundUserByEmail._id,
				type: foundUserByEmail.type,
				first_name: foundUserByEmail.first,
				last_name: foundUserByEmail.last,
				name: foundUserByEmail.name,
				email: foundUserByEmail.email,
				hashedPassword: foundUserByEmail.hashedPassword,
				jwts: foundUserByEmail.jwts,
				created_on: foundUserByEmail.created_on,
				updated_on: foundUserByEmail.updated_on,
				description: foundUserByEmail.description
			})
		}
		return foundUserByEmail
	}

	static async findById( id ) {
		let foundUserById
		try {
			await client.connect()
			const db = client.db(Database)
			const users = db.collection(Collection)
			foundUserById = await users.findOne( {_id: ObjectId(id) })
		} catch (err) {
			debug('Exception during findById')
			throw new Error(err.message)
		} finally {
			await client.close()
		}
		// If no user found by ObjectId(_id), returned result is NULL.
		if(foundUserById != null) {
			return new User( {
				id: foundUserById._id,
				type: foundUserById.type,
				first_name: foundUserById.first,
				last_name: foundUserById.last,
				name: foundUserById.name,
				email: foundUserById.email,
				hashedPassword: foundUserById.hashedPassword,
				jwts: foundUserById.jwts,
				created_on: foundUserById.created_on,
				updated_on: foundUserById.updated_on,
				description: foundUserById.description
			})
		}
		return foundUserById
	}

	toString() {
		return JSON.stringify({
			_id: this._id,
			type: this._type,
			first_name: this._first,
			last_name: this._last,
			full_name: this._name,
			email: this._email,
			password: this._hashedPassword,
			jwts: this._jwts,
			description: this._description,
			created_on: this._created_on,
			updated_on: this._updated_on
		}, null, 2 )
	}

	serialize(  ) {
		let propertiesToSerialize = ['_type', '_first', '_last', '_name', '_email', '_hashedPassword', '_created_on', '_updated_on', '_description', '_jwts']
		let that = this
		// console.dir(that._jwts)
		debug(that._jwts)
		return JSON.stringify( that, propertiesToSerialize )
	}

	requiredProperties() {
		return ['_first', '_last', '_email', '_hashedPassword', '_jwts', '_type']
	}

	checkRequired() {
		let missing = []
		for(let key of this.requiredProperties()) {
			if(!this[key] || this[key] === null || this[key] === 'undefined' || this[key] === '') {
				missing.push(key)
			}
		}
		if(missing.length > 0) {
      let msg = missing.map(item=>item.slice(1)).join(', ')
      throw new Error(`Missing the follwing required properties: ${msg}`)
		}
		return true
	}
	checkDB() {
		let missing = []
		if (!this.dbClient || this.dbClient === null || this.dbClient === 'undefined') {
			missing.push('DB client connection object')
		}
		if (!this.dbDatabase || this.dbDatabase === null || this.dbDatabase === 'undefined') {
			missing.push('Database name')
		}
		if (!this.dbCollection || this.dbCollection === null || this.dbCollection === 'undefined') {
			missing.push('Collection name')
		}
		if(missing.length > 0) {
			let msg = missing.join(', ')
			throw new Error(`Missing the following required database properties: ${msg}`)
		}
		return true
	}

	async update() {
		// Check required properties are all non-null values.
		// Throw an exception error back to the caller if not. 
		debug('1: Calling checkRequired()')
		this.checkRequired()
		// Check database client connection is available.
		// Throw an exception error back to the caller if not.
		this.checkDB()
		debug('2: Calling checkDB()')
		let result;
		try {
			await this.dbClient.connect()
			debug('3: Calling dbClient.connect()')
			const database = this.dbClient.db(this.dbDatabase)
			const users = database.collection(this.dbCollection)
			debug(`4: Setting update filter doc with ${this._id}`)
			let filter = { _id: this.objectId(this._id) }
			const update = {
			$set: { 
				type: this._type, 
				first: this._first,
				last: this._last,
				email: this._email,
				hashedPassword: this._hashedPassword,
				jwts: this._jwts,
				createdOn: this._created_on,
				updatedOn: Date.now(),
				description: this._description
			}
			}
			const options = { writeConcern: { w: 'majority' }, upsert: false, returnDocument: 'after', projection: { _id: 1, email: 1, first: 1 } }
			debug('5: Calling findOneAndUpdate.')
			result = await users.findOneAndUpdate( filter, update, options )
		} catch (err) {
			if(err) {
				// console.log(err)
				debug('6: catch err', err)
			}
		} finally {
			await this.dbClient.close()
		}
		debug('7: returning result')
		return result
	}

	// async save( insertOrUpdate = 'insert') {
	async save() {
		// Check required properties are all non-null values.
		// Throw an exception error back to the caller if not. 
		debug('1: Calling checkRequired()')
		this.checkRequired()
		// Check database client connection is available.
		// Throw an exception error back to the caller if not.
		this.checkDB()
		debug('2: Calling checkDB()')
		let result;
		try {
			await this.dbClient.connect()
			debug('3: Calling dbClient.connect()')
			const database = this.dbClient.db(this.dbDatabase)
			const users = database.collection(this.dbCollection)
			this._updated_on = Date.now()
			// Inserting a new user.
			debug('5: This is a new user - insertOne.')
			const insert = {
				type: this._type, 
				first: this._first,
				last: this._last,
				email: this._email,
				hashedPassword: this._hashedPassword,
				jwts: this._jwts,
				createdOn: this._created_on,
				updatedOn: this._updated_on,
				description: this._description
			}
			const options = { writeConcern: { w: 'majority' } }
			debug('6: Calling insertOne.')
			result = await users.insertOne( insert, options )
			debug('7: typeof result = ', typeof result)
			if(result?.insertedId != null) {
			// Get the newly creted ObjectId and assign it to this._id.
			debug('ObjectId: ', result.insertedId.toString())
			this._id = result.insertedId.toString()
			}
		} catch (err) {
			if(err) {
				// console.log(err)
				debug('8: catch err', err)
			}
		} finally {
			await this.dbClient.close()
		}

		debug('9: returning result')
		// return result
		return this 
	}

	set id( id ) {
		this._id = id
	}
	get id() {
		return this._id
	}
	set password( password ) {
		// Have to, for now, rely on synchronous hash method
		// because it is awkward to use async/await promise here.
		this._hashedPassword = bcrypt.hashSync(password, 10)
	}
	get password() {
		return this._hashedPassword
	}
	set firstName(first) {
		this._first = first
		if (!this._name || this._name === null || this._name === 'undefined') {
			if (this._last != null && this._last != 'undefined') {
				this._name = `${this._first} ${this._last}`
			}
		}
	}
	get firstName() {
		return this._first
	}
	set lastName(last) {
		this._last = last
		if (!this._name || this._name === null || this._name === 'undefined') {
			if (this._first != null && this._first != 'undefined') {
				this._name = `${this._first} ${this._last}`
			}
		}
	}
	get lastName() {
		return this._last
	}
	set email(email) {
		this._email = email
	}
	get email() {
		return this._email
	}
	set jwts(tokens) {
		this._jwts = tokens
	}
	get jwts() {
		return this._jwts
	}
	set name(newName) {
		this._name = newName
	}
	get name() {
		if (!this._name || this._name === '' || this._name === 'undefined') {
			return `${this._first} ${this._last}`
		} else {
			return this._name
		}
	}
	get description() {
		return this._description
	}
	set type(userType = 'User') {
		if(userType.toLowerCase() === 'admin') {
			this._type = 'Admin'
		} else {
			this._type = 'User'
		}
	}
	get type() {
		return this._type
	}
	set db(db) {
		this.dbClient = db
	}
	get db() {
		return this.dbClient
	}
}

module.exports = User
