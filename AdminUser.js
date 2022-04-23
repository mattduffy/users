/**
 * @module @mattduffy/users
 */
const debug = require('debug')('users:AdminUser')
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
		this._description = 'This ia an Admin level user.'
		debug(this._description)
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

	// toString() {
	// 	// debug(super.email)
	// 	return super.toString()
	// }
}

module.exports = AdminUser

