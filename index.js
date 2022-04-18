// require('dotenv').config({ path: 'tests/.env', debug: process.env.DEBUG });
const debug = require('debug')('users:index')
const User = require('./User.js')

class Users {
	constructor( mongoClient ) {
		this.db = mongoClient
	}
	
	// static newUser() {
	newUser() {
		if (this._db === null) {
			debug('No MongoDB client connection object provided.')
			throw new Error('No MongoDB client connection object provided.')
		}
		return new User( this._db )
	}

	// static getById( id = null ) {
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

	// static getByEmail( email = null ) {
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

	// static getBySessionId( sessionId = null ){
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

module.exports = ( mongodb  ) => { return new Users( mongodb ) }

