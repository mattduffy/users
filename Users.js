// require('dotenv').config( { path: './tests/.env' } )
// const {client, genTokens} = require('./db_connection_test.js')
const debug = require('debug')('users:Users')
const User = require('./User.js')

function createNewBasicUser( mongo = null, properties = {} ) {
	debug('Creating a new basic user')
	if (!mongo) {
		throw new Error('DB connection object required.')
	}
	if (!properties.hasOwnProperty('first_name') || !properties.hasOwnProperty('last_name') || !properties.hasOwnProperty('email') || !properties.hasOwnProperty('password') ) {
		let msg = `The following fields are required to create a new user:\n`
		msg += `    - first_name: new user's first name.\n`
		msg += `    - last_name: new user's last name.\n`
		msg += `    - email: new user's valid email address.\n`
		msg += `    - password: new user's password to be hashed.`
		throw new Error(msg)
	}
	return new User(mongo, properties)
}

function getUserByEmailAddress( email = null ) {
	if (!email) {
		throw new Error('Email Address is required.')
	}
	return User.byEmail(email)
}


module.exports = {
	newUser: createNewBasicUser,
	byEmail: getUserByEmailAddress
}
