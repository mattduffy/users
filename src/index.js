/**
 * This package is intended to encapsulate all of the data modeling for creating
 * using different types of User objects.  The data model can handle password
 * authentication, JWT verification via @mattduffy/mft package.
 * @summary A package used to create user models.
 * @exports @mattduffy/users
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file tests/index.js
 */
/**
 * Usage:
 * import { Users } from '@mattduffy/users'
 * const users = Users(<mongoclient>, [<koa-ctx>])
 * let matt = users.getByEmail('matt@mattmail.email.602b')
 * matt.sessionId = '1401b6e7-307e-4864-bfe9-2e2b99a9d61d'
 * matt = await matt.update()
 */

import { rename, stat, mkdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
// import { rename } from 'node:fs'
import path from 'node:path'
import bcrypt from 'bcrypt'
import Debug from 'debug'
import { User } from './User.js'
import { AdminUser } from './AdminUser.js'
import { CreatorUser } from './CreatorUser.js'
import { AnonymousUser } from './AnonymousUser.js'

const Database = 'mattmadethese'
const Collection = 'users'

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
      return new AdminUser(this._db, this._ctx)
    }
    if (/creator/i.test(type)) {
      return new CreatorUser(this._db, this._ctx)
    }
    if (/anonymous/i.test(type)) {
      return new AnonymousUser(this._db, this._ctx)
    }
    return await new User(this._db, this._ctx)
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

  async archiveUser(ctx, id = null) {
    if (this._db === null) {
      log(this.NO_DB_OBJECT)
      throw new Error(this.NO_DB_OBJECT)
    }
    if (id === null || id === undefined) {
      throw new Error('Required user id parameter is missing.')
    }
    const archiveDir = ctx.app.dirs.archive.archive ?? path.resolve('./archive')
    let user
    try {
      user = await User.findById(id, this._db)
      user = await this.factory(user, user.type)
      if (!user) {
        return false
      }
      const userFullPublicPath = path.resolve(ctx.app.dirs.public.dir, user.publicDir)
      const userFullPrivatePath = path.resolve(ctx.app.dirs.private.dir, user.privateDir)
      log(`archiveUser archiveDir: ${archiveDir}`)
      log(`         app.publicDir: ${ctx.app.dirs.public.dir}`)
      log(`        user.publicDir: ${userFullPublicPath}`)
      log(`       user.privateDir: ${userFullPrivatePath}`)
      let archiveDirExists = false
      try {
        const stats = await stat(archiveDir)
        if (stats.isDirectory()) {
          log(`archive directory exists at ${archiveDir}`)
          archiveDirExists = true
        }
      } catch (e) {
        error(`Archive dir not found at ${archiveDir}`)
        error(e)
        const p = await mkdir(archiveDir, { recursive: true })
        error(`Making the missing archive directory at ${p}`)
        archiveDirExists = true
      }
      // compose file system path from user's MongoDB ObjectId string value.
      const fullUserArchivePath = path.resolve(`${archiveDir}/${id}`)
      log(`fullUseArchivePath: ${fullUserArchivePath}`)
      try {
        await mkdir(`${fullUserArchivePath}/public/a/`, { recursive: true })
        await mkdir(`${fullUserArchivePath}/private/a/`, { recursive: true })
      } catch (e) {
        error(`Failed to make user archive dir: ${fullUserArchivePath}`)
        error(e)
      }
      let pubDirExists
      try {
        pubDirExists = await stat(userFullPublicPath)
        pubDirExists = pubDirExists.isDirectory()
      } catch (e) {
        error(`User public dir is missing.  Should be ${userFullPublicPath}`)
        pubDirExists = false
      }
      let priDirExists
      try {
        priDirExists = await stat(userFullPrivatePath)
        priDirExists = priDirExists.isDirectory()
      } catch (e) {
        error(`User private dir is missing.  Should be ${userFullPrivatePath}`)
        priDirExists = false
      }
      const shortPublicArchive = `${id}/public/${user.publicDir}`
      const shortPrivateArchive = `${id}/private/${user.privateDir}`
      if (archiveDirExists) {
        // App archive directory exists, safe to move user's public & private directories.
        try {
          if (pubDirExists) {
            log(`shortPublicArchive: ${shortPublicArchive}`)
            const newPath = path.resolve(archiveDir, shortPublicArchive)
            await rename(userFullPublicPath, newPath)
            // user.publicDir = `archive/${shortPublicArchive}`
          }
        } catch (e) {
          error(`Moving @${user.username}'s public folder to archive failed.`)
          error(e)
        }
        try {
          if (priDirExists) {
            const newPath = path.resolve(archiveDir, shortPrivateArchive)
            await rename(userFullPrivatePath, newPath)
            // user.privateDir = `archive/${shortPrivateArchive}`
          }
        } catch (e) {
          error(`Moving @${user.username}'s private folder to archive failed.`)
          error(e)
        }
        user.archived = true
        user = await user.update()
        log(`Is ${user.username} archived? ${user.archived}`)
        return {
          username: user.username,
          public: {
            path: shortPublicArchive,
            success: pubDirExists,
          },
          private: {
            path: shortPrivateArchive,
            success: priDirExists,
          },
        }
      }
    } catch (e) {
      error(e)
      return false
    }
    return false
  }

  async getById(id = null, options = {}) {
    if (this._db === null) {
      error(this.NO_DB_OBJECT)
      throw new Error(this.NO_DB_OBJECT)
    }
    if (id === null) {
      error('Static method User.getById() called without the id value.')
      throw new Error('Missing user id value.')
    }
    const opts = { archived: false, ...options }
    try {
      const user = await User.findById(id, this._db, opts)
      if (!user) {
        return false
      }
      return await this.factory(user, user.type)
    } catch (e) {
      log(e)
      return false
    }
  }

  async getByEmail(email = null, options = {}) {
    if (this._db === null) {
      error(this.NO_DB_OBJECT)
      throw new Error(this.NO_DB_OBJECT)
    }
    if (email === null) {
      error('Static method User.getByEmail() called without the email value.')
      throw new Error('Missing email value.')
    }
    const opts = { archived: false, ...options }
    try {
      const user = await User.findByEmail(email, this._db, opts)
      if (!user) {
        return false
      }
      return await this.factory(user, user.type)
    } catch (e) {
      log(e)
      return false
    }
  }

  async getByUsername(ausername = null, options = {}) {
    if (this._db === null) {
      error(this.NO_DB_OBJECT)
      throw new Error(this.NO_DB_OBJECT)
    }
    if (ausername === null) {
      error('Static method User.getByUsername() called without the username parameter.')
      throw new Error('Missing username parameter.')
    }
    const username = (ausername[0] === '@') ? ausername.slice(1) : ausername
    const opts = { archived: false, ...options }
    try {
      const user = await User.findByUsername(username, opts)
      // if (!username) {
      if (!user) {
        return false
      }
      return await this.factory(user, user.type)
    } catch (e) {
      log(e)
      return false
    }
  }

  async getBySessionId(sessionId = null, options = {}) {
    if (this._db === null) {
      error(this.NO_DB_OBJECT)
      throw new Error(this.NO_DB_OBJECT)
    }
    if (sessionId === null) {
      error('Static method User.getBySessionId() called without the session id value.')
      throw new Error('Missing session id value')
    }
    const opts = { archived: false, ...options }
    try {
      const user = await User.findBySessionId(sessionId, opts)
      if (!user) {
        return false
      }
      return await this.factory(user, user.type)
    } catch (e) {
      log(e)
      return false
    }
  }

  async getAllArchivedUsers(filter = { archived: true }) {
    let users
    if (this._db.s.namespace.collection === undefined) {
      await this._db.connect()
      const db = this._db.db(Database)
      users = db.collection(Collection)
    } else {
      users = this._db
    }
    let archivedUserList
    let archiveFilter
    let typeFilter
    if (!filter?.userTypes) {
      typeFilter = ['Admin', 'Creator', 'User']
    } else {
      typeFilter = filter.userTypes
    }
    if (!filter?.archived) {
      archiveFilter = { archived: true }
    } else {
      archiveFilter = filter
    }
    if (users === undefined) {
      error('what happened to the mongo-client?')
      throw new Error('DB connection error')
    }
    try {
      /* eslint-disable quote-props */
      const pipeline = []
      const matchArchive = {
        '$match': archiveFilter,
      }
      const matchUserType = {
        '$match': {
          'type': { '$in': typeFilter },
        },
      }
      const group = {
        '$group': {
          _id: '$type',
          count: { '$sum': 1 },
          users: { '$push': { id: '$_id', primary_email: '$emails.primary', username: { '$concat': ['@', '$username'] } } },
        },
      }
      /* eslint-enable quote-props */
      pipeline.push(matchArchive)
      pipeline.push(matchUserType)
      pipeline.push(group)
      archivedUserList = await users.aggregate(pipeline).toArray()
    } catch (e) {
      log(e)
      return false
    }
    return archivedUserList
  }

  async getAllUsers(filter = {}) {
    // log(`s.namespace: ${this._db.s.namespace.collection}`)
    let users
    if (this._db.s.namespace.collection === undefined) {
      await this._db.connect()
      const db = this._db.db(Database)
      users = db.collection(Collection)
    } else {
      users = this._db
    }
    let userList
    let typeFilter
    if (!filter?.userTypes) {
      typeFilter = ['Admin', 'Creator', 'User']
    } else {
      typeFilter = filter.userTypes
    }
    if (users === undefined) {
      error('what happened to the user model?')
      throw new Error('User model error')
    }
    try {
      const pipeline = []
      /* eslint-disable quote-props */
      const match = {
        '$match': {
          'archived': false,
          'type': { '$in': typeFilter },
        },
      }
      const unwind = {
        '$unwind': {
          'path': '$emails',
        },
      }
      const group = {
        '$group': {
          _id: '$type',
          count: { '$sum': 1 },
          users: { '$push': { id: '$_id', primary_email: '$emails.primary', name: '$first', status: '$userStatus', username: '$username' } },
        },
      }
      /* eslint-enable quote-props */

      pipeline.push(match)
      pipeline.push(unwind)
      pipeline.push(group)
      // pipeline.push(match)
      userList = await users.aggregate(pipeline).toArray()
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
      // const filter = { 'jwts.token': token }
      const filter = { 'jwts.token': token, archived: false }
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
      email,
      user: null,
      info: null,
      error: null,
      message: null,
    }
    if (email === null || password === null) {
      throw new Error('Email and Password arguments are required.')
    }
    if (this._db === undefined) {
      error('What happened to the mongoclient?')
      throw new Error('DB connection error')
    }
    // const filter = { 'emails.primary': email }
    const filter = { 'emails.primary': email, archived: false }
    try {
      // log(`email: ${email}`)
      // log(`password: ${password}`)
      result.user = await this._db.findOne(filter)
      log(`User found: ${result.user?.emails[0].primary}`)
      log(result.user)
      if (result.user !== null) {
        if (result.user.userStatus === 'inactive') {
          result.user = false
          result.error = `Can't login ${email}. Inactive user account.`
        } else {
          log('not inactive user... bcrypt.comapring...')
          const match = await bcrypt.compare(password, result.user.hashedPassword)
          log(`match is ${match}`)
          if (match) {
            const user = await this.factory(result.user, result.user.type)
            result.user = user
          } else {
            error('bcrypt password hash compare failed')
            result.user = false
            result.error = 'Wrong password.'
          }
        }
      } else {
        result.info = `No user found with email: ${email}`
      }
    } catch (e) {
      result.user = false
      result.error = e
    }
    log(result)
    return result
  }
}

export {
  Users,
}
