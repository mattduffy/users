/**
 * This package is intended to encapsulate all of the data modeling for creating
 * using different types of User objects.  The data model can handel password
 * authentication, JWT verification via @mattduffy/mft package.
 * @summary A package used to create user models.
 * @exports @mattduffy/users
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file tests/index.js
 */
/**
 * Usage:
 * import { Users } from '@mattduffy/users'
 * const users = Users(<mongoclient>)
 * let matt = users.getByEmail('matt@mattmail.email.602b')
 * matt.sessionId = '1401b6e7-307e-4864-bfe9-2e2b99a9d61d'
 * matt = await matt.update()
 */

import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import Debug from 'debug'
import { User } from './User.js'
import { AdminUser } from './AdminUser.js'
import { CreatorUser } from './CreatorUser.js'
import { AnonymousUser } from './AnonymousUser.js'
// import { client, ObjectId } from './mongoclient.js'

const debug = Debug('users:index_log')
const error = Debug('users:index_error')

if (process.argv[1] === await readFile(fileURLToPath(import.meta.url))) {
  /* eslint-disable-next-line  */
	const dotenv = await import('dotenv')
  dotenv.config({ path: './config/.env', debug: process.env.DEBUG })
}

/**
 *
 */
class Users {
  constructor(mongoClient) {
    this._db = mongoClient
  }

  async newUser(type = 'basic') {
    if (this._db === null) {
      debug('No MongoDB client connection object provided.')
      throw new Error('No MongoDB client connection object provided.')
    }
    if (/admin/i.test(type)) {
      return new AdminUser(this._db)
    }
    if (/creator/i.test(type)) {
      return new CreatorUser(this._db)
    }
    if (/anonymous/i.test(type)) {
      return new AnonymousUser(this._db)
    }
    return await new User(this._db)
  }

  async getById(id = null) {
    if (this._db === null) {
      error('No MongoDB client connection object provided.')
      throw new Error('No MongoDB client connection object provided.')
    }
    if (id === null) {
      error('Static method User.getById() called without the id value.')
      throw new Error('Missing user id value.')
    }
    return await User.findById(id, this._db)
  }

  async getByEmail(email = null) {
    if (this._db === null) {
      error('No MongoDB client connection object provided.')
      throw new Error('No MongoDB client connection object provided.')
    }
    if (email === null) {
      error('Static method User.getByEmail() called without the email value.')
      throw new Error('Missing email value.')
    }
    return await User.findByEmail(email, this._db)
  }

  async getBySessionId(sessionId = null) {
    if (this._db === null) {
      error('No MongoDB client connection object provided.')
      throw new Error('No MongoDB client connection object provided.')
    }
    if (sessionId === null) {
      error('Static method User.getBySessionId() called without the session id value.')
      throw new Error('Missing session id value')
    }
    return await User.findBySessionId(sessionId, this._db)
  }

  async getAllUsers() {
    let array = []
    if (this._db === undefined) {
      error('what happened to the mongoclient?')
      return array
    }
    const projection = { type: 1, userStatus: 1, email: 1, first: 1, last: 1 }
    const sort = { type: 1, userStatus: 1, first: 1, last: 1 }
    const cursor = await this._db.find().project(projection).sort(sort)
    array = await cursor.toArray()
    await cursor.close()
    return array
  }
}

// export default (mongodb) => new Users(mongodb)
// export default () => new Users(client)
export {
  Users,
}
