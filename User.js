const bcrypt = require('bcrypt')
// require('dotenv').config()
// const assert = require('assert')

class User {
	constructor( mongo, config ){
		if (mongo) {
			this.dbClient = mongo
			this.dbDatabase = 'mattmadethese'
			this.dbCollection = 'users'
		}
		// Required properties for existing users.
		this._type = `User`
		this._first = config?.first_name
		this._last = config?.last_name
		this._name = null
		this._email = config?.email || ''
		this._hashedPassword = ''
		this._jwts = null

		// Optional properties to define for creating new users.
		this._id = null
		this._created_on = Date.now()
		this._updated_on = null
		this._description = 'This is a user.'
	}

	serialize(  ) {
		let propertiesToSerialize = ['_type', '_first', '_last', '_name', '_email', '_hashedPassword', '_created_on', '_updated_on', '_description', '_jwts']
		let that = this
		console.dir(that._jwts)
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

	async save() {
		// Check required properties are all non-null values.
		// Throw an exception error back out to the method caller that 
		// some required properties are missing and no save() was done.
		this.checkRequired()
		// Check that the database client connection is available.
		// Throws and exception error back to the caller if not.
		this.checkDB()
		let result
		try {
			await this.dbClient.connect()
			const database = this.dbClient.db(this.dbDatabase)
			const users = database.collection(this.dbCollection)
			const filter = { email: this._email }
			this._updated_on = Date.now()
			// const update = `{ $set:  ${this.serialize()} }`
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
			console.log(update)
			const options = { upsert: true }
			
			result = await users.updateOne( filter, update, options )
		} catch (err) {
			if(err) {
				console.log(err)
			}
		} finally {
			await this.dbClient.close()
		}
		// assign this returned result to a variable scoped just outside
		// the calling async function to avoid having to deal with catching 
		// a promise
		// let dbresult
		// async function run() { dbresult = await user.save() } )
		if(result.upsertedCount && result.upsertedCount == 1) {
			return result
		}
	}

	set password( password ) {
		(async ()=> {
			this._hashedPassword = await bcrypt.hash(password, 10)
		})()
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
