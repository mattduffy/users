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
import bcrypt from 'bcrypt'
import Debug from 'debug'
import { User } from './User.js'
import { AdminUser } from './AdminUser.js'
import { CreatorUser } from './CreatorUser.js'
import { AnonymousUser } from './AnonymousUser.js'
// import { client, ObjectId } from './mongoclient.js'

const log = Debug('users:index_log')
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
  NO_DB_OBJECT = 'No MongoDB client connection object provided.'

  constructor(mongoClient, ctx) {
    this._db = mongoClient
    this._ctx = ctx
  }

  async newUser(type = 'basic') {
    if (this._db === null) {
      log(this.NO_DB_OBJECT)
      throw new Error(this.NO_DB_OBJECT)
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

  async factory(config, type = 'null') {
    const conf = { ctx: this._ctx, ...config }
    if (this._db === null) {
      log(this.NO_DB_OBJECT)
      throw new Error(this.NO_DB_OBJECT)
    }
    if (/admin/i.test(type)) {
      log('making a new admin user')
      return new AdminUser(conf, this._db)
    }
    if (/creator/i.test(type)) {
      log('making a new creator user')
      return new CreatorUser(conf, this._db)
    }
    if (/anonymous/i.test(type)) {
      log('making a new anonymous user')
      return new AnonymousUser(conf, this._db)
    }
    log('making a new basic user')
    return await new User(conf, this._db)
  }

  async getById(id = null) {
    if (this._db === null) {
      error(this.NO_DB_OBJECT)
      throw new Error(this.NO_DB_OBJECT)
    }
    if (id === null) {
      error('Static method User.getById() called without the id value.')
      throw new Error('Missing user id value.')
    }
    try {
      const user = await User.findById(id, this._db)
      if (!user) {
        return false
      }
      return await this.factory(user, user.type)
    } catch (e) {
      log(e)
      return false
    }
  }

  async getByEmail(email = null) {
    if (this._db === null) {
      error(this.NO_DB_OBJECT)
      throw new Error(this.NO_DB_OBJECT)
    }
    if (email === null) {
      error('Static method User.getByEmail() called without the email value.')
      throw new Error('Missing email value.')
    }
    try {
      const user = await User.findByEmail(email, this._db)
      if (!user) {
        return false
      }
      return await this.factory(user, user.type)
    } catch (e) {
      log(e)
      return false
    }
  }

  async getByUsername(username = null) {
    if (this._db === null) {
      error(this.NO_DB_OBJECT)
      throw new Error(this.NO_DB_OBJECT)
    }
    if (username === null) {
      error('Static method User.getByUsername() called without the username parameter.')
      throw new Error('Missing username parameter.')
    }
    try {
      const user = await User.findByUsername(username)
      if (!username) {
        return false
      }
      return await this.factory(user, user.type)
    } catch (e) {
      log(e)
      return false
    }
  }

  async getBySessionId(sessionId = null) {
    if (this._db === null) {
      error(this.NO_DB_OBJECT)
      throw new Error(this.NO_DB_OBJECT)
    }
    if (sessionId === null) {
      error('Static method User.getBySessionId() called without the session id value.')
      throw new Error('Missing session id value')
    }
    try {
      const user = await User.findBySessionId(sessionId)
      if (!user) {
        return false
      }
      return await this.factory(user, user.type)
    } catch (e) {
      log(e)
      return false
    }
  }

  async getAllUsers(filter = {}) {
    let array = []
    let userList
    let typeFilter
    if (!filter?.userTypes) {
      typeFilter = ['Admin', 'Creator', 'User']
    } else {
      typeFilter = filter.userTypes
    }
    if (this._db === undefined) {
      error('what happened to the mongoclient?')
      throw new Error('DB connection error')
    }
    try {
      const pipeline = []
      /* eslint-disable quote-props */
      const unwind = {
        '$unwind': {
          'path': '$emails',
        },
      }
      /* eslint-disable quote-props */
      const group = {
        '$group': {
          _id: '$type',
          count: { '$sum': 1 },
          users: { '$push': { id: '$_id', primary_email: '$emails.primary', name: '$first', status: '$userStatus' } },
        },
      }
      const match = {
        '$match': {
          'type': { '$in': typeFilter },
        },
      }
      pipeline.push(match)
      pipeline.push(unwind)
      pipeline.push(group)
      // pipeline.push(match)
      userList = await this._db.aggregate(pipeline).toArray()

      // const projection = { type: 1, userStatus: 1, email: 1, first: 1, last: 1 }
      // const projection = { type: 1, userStatus: 1, 'emails.primary': 1, first: 1, last: 1 }
      // const sort = { type: 1, userStatus: 1, first: 1, last: 1 }
      // const cursor = await this._db.find(filter).project(projection).sort(sort)
      // array = await cursor.toArray()
      // array.unshift(array.length)
      // await cursor.close()
    } catch (e) {
      log(e)
      return false
    }
    // return array
    return userList
  }

  async authenticateByAccessToken(token = null) {
    const result = {
      user: null,
      message: null,
      error: null,
    }
    if (token === null) {
      throw new Error('Access token argument is required.')
    }
    if (this._db === undefined) {
      error('What happened to the mongoclient?')
      throw new Error('DB connection error.')
    }
    const validToken = /[^+\s]*[A-Za-z0-9._-]*/g.exec(token)
    if (validToken && validToken[1] !== '') {
      const filter = { 'jwts.token': token }
      try {
        result.user = await this._db.findOne(filter)
        log(`Found user by token: ${result.user.username}`)
        if (result.user !== null) {
          if (result.user.userStatus === 'inactive') {
            result.user = false
            result.message = 'Access token for an inactive user account.'
          } else {
            const userByToken = await this.factory(result.user, result.user.type)
            result.user = userByToken
            result.message = 'success'
          }
        }
      } catch (e) {
        result.user = false
        result.error = e
      }
    } else {
      result.error = 'Not a valid access token'
    }
    return result
  }

  async authenticateAndGetUser(email = null, password = null) {
    const result = {
      user: null,
      message: null,
      error: null,
    }
    if (email === null || password === null) {
      throw new Error('Email and Password arguments are required.')
    }
    if (this._db === undefined) {
      error('What happened to the mongoclient?')
      throw new Error('DB connection error')
    }
    const filter = { 'emails.primary': email }
    try {
      result.user = await this._db.findOne(filter)
      log('user found: %o', result.user)
      if (result.user !== null) {
        if (result.user.userStatus === 'inactive') {
          result.user = false
          result.message = `${email} is an inactive user account.`
        } else {
          const user = await this.factory(result.user, result.user.type)
          result.user = user
        }
      } else {
        result.message = `No user found with email: ${email}`
      }
    } catch (e) {
      result.user = false
      result.error = e
    }
    return result
  }
}

export {
  Users,
}
