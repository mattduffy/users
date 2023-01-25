/**
 * This package is intended to encapsulate all of the data modeling for creating
 * using different types of User objects.  The data model can handel password
 * authentication, JWT verification via @mattduffy/mft package.
 * @summary A package used to create user models.
 * @exports @mattduffy/users
 * @author Matthew Duffy <mattduffy@gmail.com>
 */
// This is not compatible with ESM-style imports.  Need to use esm dynamic import()
// because module.parent is only populated by require().
if (process.argv[1] === readFile(fileURLToPath(import.meta.url))) {
	/* eslint-disable-next-line  */
	const dotenv = await import('dotenv')
	dotenv.config({ path: 'config/.env', debug: process.env.DEBUG })
}
import { User } from '../src/User.js'
import { AdminUser } from '../src/AdminUser.js'
import Debug from 'debug'
const debug = Debug('users:index')

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
		return new User( this._db )
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
		return new User.byId( id, this._db )	
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
		return new User.byEmail( email, this._db )
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
		return new User.bySession( sessionId, this._db )
	}
}

//module.exports = ( mongodb  ) => { return new Users( mongodb ) }
export default ( mongodb ) => { return new Users( mongodb ) }

