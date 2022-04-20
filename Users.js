if(!module.parent) {
	require('dotenv').config( { path: './tests/.env' } )
}
// const {client, genTokens} = require('./db_connection_test.js')
// const { client, ObjectId } = require('./mongoclient.js')
const debug = require('debug')('users:Users')
const User = require('./User.js')

// function createNewBasicUser( mongo = null, properties = {} ) {
function createNewBasicUser( properties = {} ) {
	debug('Creating a new basic user')
	// if (!mongo) {
	// 	throw new Error('DB connection object required.')
	// }
	if(!properties.hasOwnProperty('first_name') || !properties.hasOwnProperty('last_name') || !properties.hasOwnProperty('email') || !properties.hasOwnProperty('password') ) {
		let msg = `The following fields are required to create a new user:\n`
		msg += `    - first_name: new user's first name.\n`
		msg += `    - last_name: new user's last name.\n`
		msg += `    - email: new user's valid email address.\n`
		msg += `    - password: new user's password to be hashed.`
		throw new Error(msg)
	}
	// return new User(mongo, properties)
	return new User(properties)
}

async function getUserByEmailAddress( email = null ) {
	if(!email) {
		throw new Error('Email Address is required.')
	}
	return await User.findByEmail(email)
}

async function getUserById( id = null ) {
	if(!id) {
		throw new Error('User ID is required.')
	}
	return await User.findById(id)
}

async function comparePasswords( email = null, password = null ) {
	if(!email || !password) {
		throw new Error('Email and password are required.')
	}
	return await User.cmpPassword( email, password )
}

module.exports = {
	newUser: createNewBasicUser,
	findByEmail: getUserByEmailAddress,
	findById: getUserById,
	cmpPassword: comparePasswords
}
