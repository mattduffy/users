/**
 * This package is intended to encapsulate all of the data modeling for creating
 * using different types of User objects.  The data model can handel password
 * authentication, JWT verification via @mattduffy/mft package.
 * @summary A package used to create user models.
 * @exports @mattduffy/users
 * @author Matthew Duffy <mattduffy@gmail.com>
 */
if(!module.parent) {
	require('dotenv').config({ path: 'tests/.env', debug: process.env.DEBUG });
}
const debug = require('debug')('users:index')
const BasicUser = require('./User.js')
const AdminUser = require('./AdminUser.js')

/**
 * 
 */
class Users {
	constructor( mongoClient ) {
		this.db = mongoClient
	}
	
	newUser( type = 'basic' ) {
		if (this._db === null) {
			debug('No MongoDB client connection object provided.')
			throw new Error('No MongoDB client connection object provided.')
		}
		if(type === 'admin') {
			return new AdminUser( this._db )
		} else {
		return new BasicUser( this._db )
		}
	}

	getById( id = null ) {
		if (this._db === null) {
			debug('No MongoDB client connection object provided.')
			throw new Error('No MongoDB client connection object provided.')
		}
		if (id === null) {
			debug('Static method User.getById() called without the id value.')
			throw new Error('Missing user id value.')
		}
		return new BasicUser.byId( id, this._db )	
	}

	getByEmail( email = null ) {
		if (this._db === null) {
			debug('No MongoDB client connection object provided.')
			throw new Error('No MongoDB client connection object provided.')
		}
		if (email === null) {
			debug('Static method User.getByEmail() called without the email value.')
			throw new Error('Missing email value.')
		}
		return new BasicUser.byEmail( email, this._db )
	}

	getBySessionId( sessionId = null ){
		if (this._db === null) {
			debug('No MongoDB client connection object provided.')
			throw new Error('No MongoDB client connection object provided.')
		}
		if (sessionId === null) {
			debug('Static method User.getBySessionId() called without the session id value.')
			throw new Error('Missing session id value')
		}
		return new BasicUser.bySession( sessionId, this._db )
	}
}

module.exports = ( mongodb  ) => { return new Users( mongodb ) }

