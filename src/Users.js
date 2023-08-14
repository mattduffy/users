/**
 * @summary Exported functions to create different user types.
 * @module @mattduffy/users
 * @author Matthew Duffy <mattduffy@gmail.com>
 */

import { fileURLToPath } from 'node:url'
import Debug from 'debug'
import { User } from './User.js'
import { AdminUser } from './AdminUser.js'

const debug = Debug('users:Users')
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  /* eslist-disable-next-line */
  const dotenv = await import('dotenv')
  dotenv.config({ path: './config/.env' })
}

/**
 * Create a new instance of the User class with the default type = User.  This
 * type of user has only basic application privileges.  The properties param
 * is checked for the minimum required User properties before being passed to the User constructor.
 * @param { Object } properties - An object literal containing properties to be assigned to the new user instance.
 * @return { User } - A new (unsaved) instance of User.
 */
function createNewBasicUser(properties = {}) {
  debug('Creating a new basic user')
  if (!Object.prototype.hasOwnProperty.call(properties, 'first') || !Object.prototype.hasOwnProperty.call(properties, 'last') || !Object.prototype.hasOwnProperty.call(properties, 'emails') || !Object.prototype.hasOwnProperty.call(properties, 'password')) {
    let msg = 'The following fields are required to create a new user:\n'
    msg += '    - first: new user\'s first name.\n'
    msg += '    - last: new user\'s last name.\n'
    msg += '    - email: new user\'s valid email address.\n'
    msg += '    - password: new user\'s password to be hashed.'
    throw new Error(msg)
  }
  return new User(properties)
}

/**
 * Create a new instance of the AdminUser class.  The properties param
 * is checked for the minimum required User properties before being passed to
 * the AdminUser constructor.
 * @param { Object } properties - An object literal containing properties to be assigned to the new user instance.
 * @return { AdminUser } - A new (unsaved) instance of AdminUser.
 */
function createNewAdminUser(adminProperties = {}) {
  debug('Creating a new admin user')
  if (!Object.prototype.hasOwnProperty.call(adminProperties, 'first') || !Object.prototype.hasOwnProperty.call(adminProperties, 'last') || !Object.prototype.hasOwnProperty.call(adminProperties, 'emails') || !Object.prototype.hasOwnProperty.call(adminProperties, 'password')) {
    let msg = 'The following fields are required to create a new user:\n'
    msg += '    - first: new user\'s first name.\n'
    msg += '    - last: new user\'s last name.\n'
    msg += '    - emails: new user\'s valid email address.\n'
    msg += '    - password: new user\'s password to be hashed.'
    throw new Error(msg)
  }
  return new AdminUser(adminProperties)
}

/**
 * Query the database for an existing user by email address.
 * @async
 * @param { string } email - Email address to query by.
 * @throws { Error }
 * @return { Promise<User> } - A populated User instance or throws an Error.
 */
async function getUserByEmailAddress(email = null) {
  if (!email) {
    throw new Error('Email Address is required.')
  }
  return await User.findByEmail(email)
}

/**
 * Query the database for an existing user by ObjectId value.
 * @async
 * @param { string } id - A valid ObjectId value to query by.
 * @throw { Error }
 * @return { Promise<User> } - A populated User instance or throws an Error.
 */
async function getUserById(id = null) {
  if (!id) {
    throw new Error('User ID is required.')
  }
  return await User.findById(id)
}

/**
 * Query the database for an exisitn user by email address and compare the
 * supplied cleartext password with the Bcrypt hashed and salted password
 * associated with email address, if one is found.
 * @async
 * @param { string } email - Email address to query the database by.
 * @param { string } password - Cleartext password to compare with hash.
 * @throws { Error }
 * @return { Promise<boolean> } - True if passwords match, False if not.
 */
async function comparePasswords(email = null, password = null) {
  if (!email || !password) {
    throw new Error('Email and password are required.')
  }
  return await User.cmpPassword(email, password)
}

export {
  createNewBasicUser as newUser,
  createNewAdminUser as newAdminUser,
  getUserByEmailAddress as findByEmail,
  getUserById as findById,
  comparePasswords as cmpPassword,
}
