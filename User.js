/**
 * @module @mattduffy/users
 */
const debug = require('debug')('users:User')
const bcrypt = require('bcrypt')
const { client, ObjectId } = require('./mongoclient.js')
const Database = 'mattmadethese'
const Collection = 'users'

/**
 * @todo [ ] Create a test to authenticate user accounts base on permissions.
 * @todo [ ] Integrate with the @mattduffy/mft package to add JWT functionality.
 * @todo [ ] Add method - list albums
 */

/**
 * A class representing the basic user model.  This class contains the generic
 * properties and methods necessary to create a simple application user.  
 * Methods include saveing/updating properties, comparing password for 
 * authentication and handler for verifying JWTs.
 * @summary A class defining a basic user model.
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @module @mattduffy/users
 */
class User {
	/**
	 * Create a user model and populate the properties.
	 * @param {Object} config - An object literal with properties to initialize new user.
	 */
	constructor( config ) {
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

	/**
	 * Static property used to compare with instanceof expressions.
	 * @static
	 * @type {string}
	 */
	static type = 'User'
	/**
	 * A static class method to check if a given user object is a User. 
	 * @static
	 * @param {object} obj - Object to check instanceof against.
	 * @return {boolean} - True if object checked is instance of User class.
	 */
	static [Symbol.hasInstance]( obj ) {
		if(obj.type === this.type) return true
	}

	/**
	 * Static class method to compare a given password with a user's stored password.
	 * Passwords are Bcrypt hashed and salted before they are saved in the database.
	 * Bcrypt compare is used to compare.
	 * @static 
	 * @async
	 * @param {string} email - Email address used to find existing user in the database.
	 * @param {string} password - Cleartext password provided for comparison with hash.
	 * @return {(boolean|Error}} - True/False result of comparison or throws Error.
	 */
	static async cmpPassword( email, password ) {
		let userToComparePassword
		let filter = { email: email }
		let options = { projection: { hashedPassword: 1 }  }
		let result
		try {
			await client.connect()
			const db = client.db(Database)
			const users = db.collection(Collection)
			userToComparePassword = await users.findOne( filter, options )	
			if(userToComparePassword != null) {
				// Boolean value returned from bcrypt.compare function.
				result = await bcrypt.compare( password, userToComparePassword.hashedPassword )
			}
		} catch (err) {
			debug('Exception during cmpPasssword')
			throw new Error(err.message)
		} finally {
			await client.close()
		}
		// True if password == hashedPassword, and False if !=.
		return result
	}

	/**
	 * Static class method to find user in the database, searching by email address.
	 * @static
	 * @async
	 * @param {string} email - Email address to search by in the database.
	 * @return {Promise(<User>|null)} - Instance of User with properties populated.
	 */
	static async findByEmail( email ) {
		let foundUserByEmail
		let filter = { email: email }
		try {
			await client.connect()
			const db = client.db(Database)
			const users = db.collection(Collection)
			foundUserByEmail = await users.findOne( filter )
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
				created_on: foundUserByEmail.createdOn,
				updated_on: foundUserByEmail.updatedOn,
				description: foundUserByEmail.description
			})
		}
		return foundUserByEmail
	}

	/**
	 * Static class method to find user in the database, searching by ObjectId value.
	 * @static
	 * @async
	 * @param {string} id - ObjectId value to search by in the database.
	 * @return {Promise(<User>|null)} - Instance of User with properties populated.
	 */
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
				created_on: foundUserById.createdOn,
				updated_on: foundUserById.updatedOn,
				description: foundUserById.description
			})
		}
		return foundUserById
	}

	/**
	 * Stringifies the instance properties of the user, excluding and DB stuff.
	 * @return {string} - A stringified version of a JSON literal of user properties.
	 */
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

	/**
	 * Stringifies the instance properties of the user, excluding and DB stuff.
	 * @return {string} - A stringified version of a JSON literal of user properties.
	 */
	serialize() {
		let propertiesToSerialize = ['_type', '_first', '_last', '_name', '_email', '_hashedPassword', '_created_on', '_updated_on', '_description', '_jwts']
		let that = this
		debug(that._jwts)
		return JSON.stringify( that, propertiesToSerialize )
	}

	/**
	 * Returns an array of the minimum required properties to instantiate a new user.
	 */
	requiredProperties() {
		return ['_first', '_last', '_email', '_hashedPassword', '_jwts', '_type']
	}

	/**
	 * Sanity check to ensure all required properties have a value before saving the user.
	 * @return {(boolean|Error)} - True or throws Error if missing any required properties.
	 */
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

	/**
	 * Sanity check to ensure a valid database client connection object is present before
	 * issuing any database queries.
	 * @return {(boolean|Error)} - True or throws Error is client connection is not working.
	 */
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

	/**
	 * Performs an update on an existing user.  All user instance properties are sent
	 * back to the database during the update.  Update query requires the user to have
	 * a valid ObjectId value.
	 * @async
	 * @return {Promise(<UpdateResult>|Error)} - MongoDB UpdateResult object or throws an Error.
	 */
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

	/**
	 * Performs an insert of a new user.  All user instance properties are sent
	 * to the database during the insert.  Insert query requires the user to have
	 * a unique email address.
	 * @async
	 * @return {Promise(<User>|Error)} - A populated user instance or throws an Error.
	 */
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
		debug('9: returning the newly created ObjectId value')
		// return this._id
		return result
		// return this 
	}

	/**
	 * Id property setter.
	 * @param {string} id - A value to be used as a valid ObjectId.
	 */
	set id( id ) {
		this._id = id
	}
	/**
	 * Id proptery getter.
	 * @return {string} - Current value to be used as a valid ObjectId.
	 */
	get id() {
		return this._id
	}
	/**
	 * Password proptery setter.
	 * @param {string} password - Value to be Bcyrpt hashed and salted.
	 */
	set password( password ) {
		// Have to, for now, rely on synchronous hash method
		// because it is awkward to use async/await promise here.
		this._hashedPassword = bcrypt.hashSync(password, 10)
	}
	/**
	 * Password property getter.
	 * @return {string} - Bcrypt hashed and salted password value.
	 */
	get password() {
		return this._hashedPassword
	}
	/**
	 * First name propety setter.
	 * @param {string} first - User first name value.
	 */
	set firstName( first ) {
		this._first = first
		if (!this._name || this._name === null || this._name === 'undefined') {
			if (this._last != null && this._last != 'undefined') {
				this._name = `${this._first} ${this._last}`
			}
		}
	}
	/**
	 * First name property getter.
	 * @return {string} - User first name value.
	 */
	get firstName() {
		return this._first
	}
	/**
	 * Last name propety setter.
	 * @param {string} last - User last name value.
	 */
	set lastName(last) {
		this._last = last
		if (!this._name || this._name === null || this._name === 'undefined') {
			if (this._first != null && this._first != 'undefined') {
				this._name = `${this._first} ${this._last}`
			}
		}
	}
	/**
	 * Last name property getter.
	 * @return {string} - User last name value.
	 */
	get lastName() {
		return this._last
	}
	/**
	 * Email address property setter.
	 * @param {string} - User email address value.
	 */
	set email(email) {
		this._email = email
	}
	/**
	 * Email address property getter.
	 * @return {string} - User email address value.
	 */
	get email() {
		return this._email
	}
	/**
	 * JWT object property setter.
	 * @param {object} tokens - Object literal containing JW Tokens.
	 */
	set jwts(tokens) {
		this._jwts = tokens
	}
	/**
	 * JTW object property getter.
	 * @return {Object} - User JWT object literal.
	 */
	get jwts() {
		return this._jwts
	}
	/**
	 * Full name property setter.
	 * @param {string} newName - User full name property value.
	 */
	set name(newName) {
		this._name = newName
	}
	/**
	 * Full name property getter.
	 * @return {string} - User full name value.
	 */
	get name() {
		if (!this._name || this._name === '' || this._name === 'undefined') {
			return `${this._first} ${this._last}`
		} else {
			return this._name
		}
	}
	/**
	 * Description property setter.
	 * @param {string} description - User desciption value.
	 */
	set description( description ) {
		this._description = description
	}
	/**
	 * Description property getter.
	 * @return {string} - User description property value.
	 */
	get description() {
		return this._description
	}
	/**
	 * User type property setter.
	 * @param {string} userType - User type property value.
	 */
	set type(userType = 'User') {
		if(userType.toLowerCase() === 'admin') {
			this._type = 'Admin'
		} else {
			this._type = 'User'
		}
	}
	/**
	 * User type property getter.
	 * @return {string} - User type property value.
	 */
	get type() {
		return this._type
	}
	/**
	 * Database client property setter.
	 * @param {MongoClient} db -  User db connection property value.
	 */
	set db( db ) {
		this.dbClient = db
	}
	/**
	 * Database client property getter.
	 * @return {MongoClient} - User db connection proertery value.
	 */
	get db() {
		return this.dbClient
	}
}

module.exports = User
