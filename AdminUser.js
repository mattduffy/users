/**
 * @module @mattduffy/users
 */
const debug = require('debug')('users:AdminUser')
const { client, ObjectId } = require('./mongoclient.js')
const Database = 'mattmadethese'
const Collection = 'users'
const User = require('./User.js')

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
	}
}

module.exports = AdminUser

