/**
 * @module @mattduffy/users
 */
import Debug from 'debug'
const debug = Debug('users:AdminUser')
//const User = require('./User.js')
import { User } from './User.js'

/**
 * @todo [x] Create an Admin class.
 * @todo [x] Add admin method - listUsers
 * @todo [x] Add admin method - deleteUser
 * @todo [x] Add admin method - getUsersByType
 * @todo [ ] Add admin methods - upgradUser / downgradeUser
 * @todo [ ] Add admin methods - suspendUser / reinstateUser
 * @todo [ ] Create a test to authenticate user accounts base on permissions.
 */

/**
 * A class representing the Admin user model.  This class extends the basic User
 * model.  Admin specific methods and properties are provided here.
 * @summary A class defining the admin user model.
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @module @mattduffy/users
 */
class AdminUser extends User {
	/**
	 * Create an admin user model and populate the properties.
	 * @param {Object} config - An object literal with properties to pass new user
	 * to super to instantiate the base user model.
	 */
	constructor( config ) {
		super( config )
		this._type = 'Admin'
		this._description = 'This is an Admin level user.'
		debug(this._description)
		this._userTypes = [
			{ type: 'User', description: 'This is a User level user.' },
			{ type: 'Anonymous', description: 'This is an Anonymous level user.' },
			{ type: 'Creator', description: 'This is an Creator level user.' },
			{ type: 'Admin', description: 'This is an Admin level user.' }
		]
	}

	/**
	 * Static property used to compare with instanceof expressions.
	 * @static
	 * @type {string}
	 */
	static type = 'Admin'
	/**
	 * A static class method to check if a given user object is an Admin User. 
	 * @static
	 * @param {object} obj - Object to check instanceof against.
	 * @return {boolean} - True if object checked is instance of AdminUser class.
	 */
	static [Symbol.hasInstance]( obj ) {
		if(obj.type === this.type) return true
	}

	/**
	 * Upgrade a user account to the next higher privilege level.
	 * @static
	 * @param {string} id - String value of ObjectId of the user to upgrade.
	 * @return {boolean} - True if successful, false otherwise.
	 */
	static async upgradeUser( id = null ) {
		let wasSuccessful = false
		if ( id === null ) {
			throw new Error('A valid user id in the form of an ObjectId must be provided.')
		}
		this.checkDB()
		try {
			await this.dbClient.connect()
			debug('1: Calling dbClient.connect method')
			const database = this.dbClient.db(this.dbDatabase)
			const users = database.collection(this.dbCollection)
		  const filter = { _id: this.objectId( id ) }
			const options = {}
			const userToUpgrade = users.findOne({_id: ObjectId(id)})


		} catch (error) {
			debug(error)
		} finally {
			await this.dbClient.close()
		}
		return wasSuccessful
	}

	/**
	 * Query the database for all existing user accounts.
	 * @async
	 * @return {(Promise<array>|Error)} - An array of users.
	 */
	async listUsers() {
		this.checkDB()
		let userList;
		try {
			await this.dbClient.connect()
			debug('1: Calling dbClient.connect method ')
			const database = this.dbClient.db(this.dbDatabase)
			const users = database.collection(this.dbCollection)
			const pipeline = []
			const group = {
				'$group': {
					'_id': '$userStatus', 
					'count': { '$sum': 1 },
					'users': { '$push': { 'id': '$_id', 'email': '$email', 'name': '$first' } }
				} } 
			pipeline.push(group)
			userList = await users.aggregate(pipeline).toArray()
		} catch (error) {
			debug(error)
		} finally {
			await this.dbClient.close()
		}
		// userList = userList.toArray()
		return userList
	}

	/**
	 * Query the database for all users by type.
	 * @async
	 * @param {string} type - User type to query by.
	 * @return {(Promise<array>|Error)} - An array of users.
	 */
	async getUsersByType( type = 'all' ) {
		debug(`What is going on with the <type> param? ${type}`)
		if(type === null || type === '' || type === 'undefined') {
			throw new Error('A valid user type was not supplied.')
		}
		this.checkDB()
		let userList
		let match
		try {
			await this.dbClient.connect()
			const database = this.dbClient.db(this.dbDatabase)
			const users = database.collection(this.dbCollection)
			const pipeline = []
			if(/all/i.test(type) ) {
				// match = { '$match': { 'type': { '$exists': true } } }
				match = { '$match': { type: { '$exists': true } } }
			} else {
				let userType = type[0].toUpperCase()+type.slice(1)
				match = { '$match': { type: userType } }
			}
			// debug('match: %O', match)
			pipeline.push(match)
			let group = {
					'$group': {
						_id: '$type',
						count: { '$sum': 1 },
						users: { '$push': { id: '$_id', email: '$email', name: '$first', status: '$userStatus' } }
					}
				}
			// debug('group: %O', group)
			pipeline.push(group)
			// debug('pipeline: %O', pipeline, { depth: null })
			// console.dir(pipeline,  { depth: null })
			userList = await users.aggregate(pipeline).toArray()
			console.dir(userList)
		} catch (error) {
			debug(error)
		} finally {
			await this.dbClient.close()
		}
		return userList
	}

	/**
	 * Delete a user from the database, identified by either id or email address.
	 * @async
	 * @param {string} id - String value of an ObjectId
	 * @param {string} email = String value of an email address.
	 * @return {Promise<boolean>} - True if delete is successful, false if not.
	 */
	async deleteUser( id = null, email = null ) {
		if(id === null && email === null) {
			throw new Error('Either an id or email address are required.')
		}
		this.checkDB()
		let deleteSuccessful
		let deleteFilter
		try {
			debug('1: Calling dbClient.connect()')
			await this.dbClient.connect()
			const database = this.dbClient.db(this.dbDatabase)
			const users = database.collection(this.dbCollection)
			if(id != null && id != '') {
				deleteFilter = { _id: this.objectId(id) }
			} 
			if(email != null && email != '') {
				deleteFilter = { email: email }
			} 
			deleteSuccessful = await users.deleteOne( deleteFilter )
		} catch (error) {
			debug(error)
		} finally {
			await this.dbClient.close()
		}
		// If no delete occurred: deleteSuccessful.deletedCount: 0 
		return deleteSuccessful
	}

}

export { AdminUser }
