/**
 * @module @mattduffy/users
 * @file /src/User.js
 */
import Debug from 'debug'
import bcrypt from 'bcrypt'
import path from 'node:path'
import { rename } from 'node:fs'
import { stat, writeFile, readFile, mkdir } from 'node:fs/promises'
import { createHash, subtle } from 'node:crypto'
import { client, ObjectId } from './mongoclient.js'

const log = Debug('users:User')
const error = Debug('users:User_error')
const DATABASE = 'mattmadethese'
const COLLECTION = 'users'

/**
 * @todo [ ] Create a test to authenticate user accounts base on permissions.
 * @todo [ ] Integrate with the @mattduffy/mft package to add JWT functionality.
 * @todo [ ] Add method - list albums
 */

/**
 * A class representing the basic user model.  This class contains the generic
 * properties and methods necessary to create a simple application user.
 * Methods include saveing/updating properties, comparing password for
 * authentication and handler for verifying JWTs.
 * @summary A class defining a basic user model.
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @module @mattduffy/users
 */
class User {
  SCHEMA_VERSION = 4

  /**
   * Class property set to an Array of Object literals containing email addresses.
   */
  _emails

  /**
   * Create a user model and populate the properties.
   * @param {Object} config - An object literal with properties to initialize new user.
   */
  constructor(config) {
    this.log = log
    this.objectId = ObjectId
    this.dbClient = client
    this.dbDatabase = 'mattmadethese'
    this.dbCollection = 'users'
    this._ctx = config?.ctx ?? {}
    this._id = config?._id ?? config?.id ?? null
    this._type = config?.type ?? 'User'
    this._first = config?.first_name ?? config?.first ?? null
    this._last = config?.last_name ?? config?.last ?? null
    // this._email = config?.email ?? ''
    this._emails = config?.emails ?? []
    this._hashedPassword = null
    this.password = config?.password ?? config.hashedPassword
    let fullName
    if (config.name != null && config.name !== '') {
      fullName = config.name
    } else if (this._first != null && this._last != null) {
      fullName = `${this._first} ${this._last}`
    }
    this._name = fullName ?? null
    this._username = config?.username ?? this._name.toLowerCase().replace(' ', '')
    this._displayName = config?.displayname ?? config?.displayName ?? config.display_name ?? this._name
    this._url = config?.url ?? `/@${this._username}`
    // this._url = this.#fixUsernameUrl(this._url)
    this._avatar = config?.avatar ?? config?._avatar ?? '/i/accounts/avatars/missing.png'
    // this._avatar = this.#fixAvatarUrl(this._avatar)
    this._header = config?.header ?? config?._header ?? '/i/accounts/headers/generic.png'
    // this._header = this.#fixHeaderUrl(this._header)
    this._keys = config?.keys ?? {}
    this._jwts = config?.jwts ?? null
    this._created_on = config?.createdOn ?? config?.created_on ?? Date.now()
    this._updated_on = config?.updatedOn ?? config?.updated_on ?? null
    this._description = config?.description ?? 'This is a user.'
    this._userStatus = config?.status ?? config?.userStatus ?? 'inactive'
    this._publicDir = config?.publicDir ?? null
    this._privateDir = config?.privateDir ?? null
    this._sessionId = config?.sessionId ?? null
    this._schemaVer = config?.schemaVer
    // Mastodon specific required fields
    this._isLocked = config?.locked ?? config?.isLocked ?? true
    this._isBot = config?.bot ?? false
    this._isDiscoverable = config?.discoverable ?? true
    this._isGroup = config?.group ?? false
    this._fields = config?.fields ?? []
    this._emojis = config?.emojis ?? []
    this._followers_count = config?.followers_count ?? 0
    this._following_count = config?.following_count ?? 0
    // Is this user account archived?
    this._archived = config?.archived ?? false
  }

  /**
   *
   */
  #fixHeaderUrl(url) {
    let goodUrl = url
    // const { protocol, host } = this._ctx
    const { origin } = this._ctx.request
    const pattern = new RegExp(`${origin}/i/a/avatars/.*$`)
    if (!pattern.test(url)) {
      goodUrl = url.replace(/^(http|https):\/\/(<<app.host>>)\/(.*)$/, (m, p, h, x) => `${origin}/${x}`)
    }
    return goodUrl
  }

  /**
   *
   */
  #fixAvatarUrl(url) {
    let goodUrl = url
    const { protocol, host } = this._ctx
    const pattern = new RegExp(`${host}/i/accounts/avatars/.*$`)
    if (!pattern.test(url)) {
      goodUrl = url.replace(/^(http|https):\/\/(<<app.host>>)\/(.*)$/, (m, p, h, x) => `${protocol}://${host}/${x}`)
    }
    return goodUrl
  }

  /**
   *
   */
  #fixUsernameUrl(url) {
    let goodUrl = url
    const { protocol, host } = this._ctx
    const pattern = new RegExp(`${host}/@(.*){2,30}$`)
    if (!pattern.test(url)) {
      goodUrl = url.replace(/^(http|https):\/\/(<<app.host>>)\/(.*)/, () => `${protocol}://${host}/@${this._username}`)
    }
    return goodUrl
  }

  /**
   * Static property used to compare with instanceof expressions.
   * @static
   * @typeOfUser {string}
   */
  static typeOfUser = 'User'

  /**
   * A static class method to check if a given user object is a User.
   * @static
   * @param { object } obj - Object to check instanceof against.
   * @return { boolean } - True if object checked is instance of User class.
   */
  static [Symbol.hasInstance](obj) {
    if (obj.typeOfUser === this.typeOfUser) return true
    return false
  }

  /**
   * Static class method to compare a given password with a user's stored password.
   * Passwords are Bcrypt hashed and salted before they are saved in the database.
   * Bcrypt compare is used to compare.
   * @static
   * @async
   * @param { string } email - Email address used to find existing user in the database.
   * @param { string } password - Cleartext password provided for comparison with hash.
   * @return { (boolean|Error) } - True/False result of comparison or throws Error.
   */
  static async cmpPassword(email, password) {
    let userToComparePassword
    // const filter = { email }
    const filter = { email, archived: false }
    const options = { projection: { hashedPassword: 1 } }
    let result
    try {
      await client.connect()
      const db = client.db(this.dbDatabase)
      const users = db.collection(this.dbCollection)
      userToComparePassword = await users.findOne(filter, options)
      if (userToComparePassword != null) {
        // Boolean value returned from bcrypt.compare function.
        result = await bcrypt.compare(password, userToComparePassword.hashedPassword)
      }
    } catch (err) {
      error('Exception during cmpPasssword')
      throw new Error(err.message)
    } finally {
      await client.close()
    }
    // True if password == hashedPassword, and False if !=.
    return result
  }

  /**
   * Simple class method wrapper around fs/promises.mkdir function.
   * @summary Simple class method wrapper around fs/promises.mkdir function.
   * @async
   * @param { string } directory - Path of directory to be created.
   * @return { undefined }
   * @throws { Error } If directory argument is missing or already exists.
   */
  /* eslint-disable-next-line class-methods-use-this */
  async makedir(directory) {
    try {
      await mkdir(directory, { recursive: true })
      return true
    } catch (e) {
      error(`Failed to mkdir ${directory}`)
      throw e
    }
  }

  /**
   * Private class method to generate Webcrypto Subtle signing key pair.
   * @summary Private class method to generate Webcrypto Subtle signing key pair.
   * @async
   * @param { object } o - Webcrypto Subtle key generation options.
   * @return { object } An object literal with status and generated keys.
   */
  async #generateSigningKeys(o = {}) {
    const keyOpts = o
    let keyExists
    const pubKeyPath = path.resolve(this._ctx.app.dirs.public.dir, `${this.publicDir}/rs256-pub.pem`)
    const jwkeyPath = path.resolve(this._ctx.app.dirs.public.dir, `${this.publicDir}/rs256.jwk`)
    const priKeyPath = path.resolve(this._ctx.app.dirs.private.dir, `${this.privateDir}/rs256-pri.pem`)
    try {
      keyExists = await stat(pubKeyPath)
      if (keyExists.isFile()) {
        // Check if keys already exists.  If so, no-op.
        return { status: null }
      }
    } catch (e) {
      error(`fs.stat(${pubKeyPath}) failed.  Keys not created yet.`)
      keyExists = false
    }
    log(`Creating ${this.username}'s RS256 keypair.`)
    const keys = subtle.generateKey(
      {
        name: keyOpts.name,
        modulusLength: keyOpts.modulusLength,
        publicExponent: keyOpts.publicExponent,
        hash: keyOpts.hash,
      },
      keyOpts.extractable,
      keyOpts.uses,
    )
    let pub
    let jwk
    let pri
    try {
      jwk = await subtle.exportKey('jwk', keys.publicKey)
      keys.jwk = jwk
      pub = await subtle.exportKey('spki', keys.publicKey)
      pri = await subtle.exportKey('pkcs8', keys.privateKey)
    } catch (e) {
      error('Failed to export newly generated keypair.')
      error(e)
      return { status: null }
    }
    //
    // Code goes here to convert raw keys to PEM encoded files.
    //
    let pubToPem = Buffer.from(String.fromCharCode(...new Uint8Array(pub)), 'binary').toString('base64')
    pubToPem = pubToPem.match(/.{1,64}/g).join('\n')
    pubToPem = `-----BEGIN PUBLIC KEY-----\n${pubToPem}\n-----END PUBLIC KEY-----`
    let priToPem = Buffer.from(String.fromCharCode(...new Uint8Array(pri)), 'binary').toString('base64')
    priToPem = priToPem.match(/.{1,64}/g).join('\n')
    priToPem = `-----BEGIN PRIVATE KEY-----\n${pubToPem}\n-----END PRIVATE KEY-----`
    try {
      log(`Saving ${pubKeyPath}`)
      await writeFile(pubKeyPath, pubToPem)
      log(`Saving ${jwkeyPath}`)
      await writeFile(jwkeyPath, jwk)
      log(`Saving ${pubKeyPath}`)
      await writeFile(priKeyPath, priToPem)
    } catch (e) {
      error(`Failed to save newly generated keypair to ${this.username}'s account.`)
      error(e)
      return { status: null }
    }
    return {
      status: 'success',
      name: keyOpts.name,
      hash: keyOpts.hash,
      bits: keyOpts.modulusLength,
      publicKey: pubKeyPath,
      privateKey: priKeyPath,
      jwk,
    }
  }

  /**
   * Private class method to generate Webcrypto Subtle encrypting key pair.
   * @summary Private class method to generate Webcrypto Subtle encrypting key pair.
   * @async
   * @param { object } o - Webcrypto Subtle key generation options.
   * @return { object } An object literal with status and generated keys.
   */
  async #generateEncryptingKeys(o = {}) {
    const keyOpts = o
    let keyExists
    const pubKeyPath = path.resolve(this._ctx.app.dirs.public.dir, `${this.publicDir}/rsa-oaep-pub.pem`)
    const jwkeyPath = path.resolve(this._ctx.app.dirs.public.dir, `${this.publicDir}/rsa-oaep.jwk`)
    const priKeyPath = path.resolve(this._ctx.app.dirs.private.dir, `${this.privateDir}/rsa-oaep-pri.pem`)
    try {
      keyExists = await stat(pubKeyPath)
      if (keyExists.isFile()) {
        // Check if keys already exists.  If so, no-op.
        return { status: null }
      }
    } catch (e) {
      error(`fs.stat(${pubKeyPath}) failed.  RSA-OAEP encrypting keypair not created yet.`)
      keyExists = false
    }
    log(`Creating ${this.username}'s RSA-OAEP keypair.`)
    const keys = subtle.generateKey(
      {
        name: keyOpts.name,
        modulusLength: keyOpts.modulusLength,
        publicExponent: keyOpts.publicExponent,
        hash: keyOpts.hash,
      },
      keyOpts.extractable,
      keyOpts.uses,
    )
    let pub
    let jwk
    let pri
    try {
      jwk = await subtle.exportKey('jwk', keys.publicKey)
      keys.jwk = jwk
      pub = await subtle.exportKey('spki', keys.publicKey)
      pri = await subtle.exportKey('pkcs8', keys.privateKey)
    } catch (e) {
      error('Failed to export newly generated AES-OAEP keypair.')
      error(e)
      return { status: null }
    }
    //
    // Code goes here to convert raw keys to PEM encoded files.
    //
    let pubToPem = Buffer.from(String.fromCharCode(...new Uint8Array(pub)), 'binary').toString('base64')
    pubToPem = pubToPem.match(/.{1,64}/g).join('\n')
    pubToPem = `-----BEGIN PUBLIC KEY-----\n${pubToPem}\n-----END PUBLIC KEY-----`
    let priToPem = Buffer.from(String.fromCharCode(...new Uint8Array(pri)), 'binary').toString('base64')
    priToPem = priToPem.match(/.{1,64}/g).join('\n')
    priToPem = `-----BEGIN PRIVATE KEY-----\n${pubToPem}\n-----END PRIVATE KEY-----`
    try {
      log(`Saving ${pubKeyPath}`)
      await writeFile(pubKeyPath, pubToPem)
      log(`Saving ${jwkeyPath}`)
      await writeFile(jwkeyPath, jwk)
      log(`Saving ${pubKeyPath}`)
      await writeFile(priKeyPath, priToPem)
    } catch (e) {
      error(`Failed to save newly generated AES-OAEP keypair to ${this.username}'s account.`)
      error(e)
      return { status: null }
    }
    return {
      status: 'success',
      name: keyOpts.name,
      hash: keyOpts.hash,
      bits: keyOpts.modulusLength,
      publicKey: pubKeyPath,
      privateKey: priKeyPath,
      jwk,
    }
  }

  /**
   * Create public/private encryption keys.
   * @summary Create public/private encryption keys.
   * @see https://www.nearform.com/blog/implementing-the-web-cryptography-api-for-node-js-core/
   * @async
   * @param { object } sign - Webcrypto Subtle signing key generation options.
   * @param { object } enc - Webcrypto Subtle encrypting key generation options.
   * @return { object } An object literal with success or error status.
   */
  async generateKeys(sign = {}, enc = {}) {
    if (this._archived) {
      // no-op
      return { status: null }
    }
    const signingKeyOpts = {
      name: process.env.SIGNING_KEY_TYPE ?? 'RSASSA-PKCS1-v1_5',
      modulusLength: process.env.SIGNING_KEY_BITS ?? 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: process.env.SIGNING_KEY_HASH ?? 'SHA-256',
      extractable: process.env.SIGNING_KEY_EXTRACTABLE ?? true,
      uses: ['sign', 'verify'],
      ...sign,
    }
    const encryptingKeyOpts = {
      name: process.env.SIGNING_KEY_TYPE ?? 'RSA-OAEP',
      modulusLength: process.env.SIGNING_KEY_BITS ?? 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: process.env.ENCRYPTING_KEY_TYPE ?? 'SHA-256',
      extractable: process.env.ENCRYPTING_KEY_EXTRACTABLE ?? true,
      uses: ['encrypt', 'decrypt'],
      ...enc,
    }
    let signingKeys
    try {
      signingKeys = await this.#generateSigningKeys(signingKeyOpts)
      this._keys.signing = signingKeys
      delete this._keys.signing.status
    } catch (e) {
      error('Failed to generate Webcrypto.subtle signing keys.')
      error(e)
      return { status: 'failed' }
    }
    let encryptingKeys
    try {
      encryptingKeys = await this.#generateEncryptingKeys(encryptingKeyOpts)
      this._keys.encrypting = encryptingKeys
      delete this._keys.encrypting.status
    } catch (e) {
      error('Failed to generate Webcrypto.subtle encrypting keys.')
      error(e)
      return { status: 'failed' }
    }
    return {
      status: 'success',
      signing: signingKeys,
      encrypting: encryptingKeys,
    }
  }

  /**
   * Simple class method wrapper around fs/promises.rename function.
   * @summary Simple class method wrapper around fs/promises.rename function.
   * @param { string } directory - Path of directory to be renamed.
   * @return { undefined }
   * @throws { Error } If directory argument is missing or doesn't already exists.
   */
  /* eslint-disable-next-line class-methods-use-this */
  renamedir(newName) {
    const oldName = `${this._ctx.app.publicDir}/${this._publicDir}`
    log(`Renaming ${oldName} to ${newName}`)
    try {
      rename(oldName, newName, (err) => {
        if (err) {
          error('fs:rename sync error: %o', err)
          throw err
        }
      })
      return true
    } catch (e) {
      error(`Failed to rename ${oldName} to ${newName}`)
      throw e
    }
  }

  /**
   * Class method to update user's password.
   * @summary Class method to update user's password.
   * @async
   * @param { string } currentPassword - User's current password, to test is correct.
   * @param { string } newPassword - New string value to be hashed and saved.
   * @return { object } - Object literal with success message or error.
   */
  async updatePassword(currentPassword = null, newPassword = null) {
    const result = {
      message: null,
      success: null,
      error: [],
      // originalHash: this.password,
    }
    if (!currentPassword) {
      result.error.push('Missing required current password parameter.')
      result.success = false
    }
    if (!newPassword) {
      result.error.push('Missing required new password parameter.')
      result.success = false
    }
    if (result.error.length > 0) {
      result.error = result.error.join('\n')
      result.success = false
      return result
    }
    if (await bcrypt.compare(currentPassword, this._hashedPassword)) {
      // currentPassword is a match, hash new password
      this.password = newPassword
      result.error = null
      result.message = 'Password has been updated'
      result.success = true
      // result.newHash = this.password
    } else {
      result.error = 'Current password was not a valid match.'
      result.success = false
    }
    return result
  }

  /**
   * Static class method to find user in the database, searching by email address.
   * @static
   * @async
   * @param { string } email - Email address to search by in the database.
   * @param { Mongodbclient } _db - Connection to db if needed.
   * @param { object } o - Additional optional filtering values.
   * @return { Promise(<User>|null) } - Instance of User with properties populated.
   */
  static async findByEmail(email, _db, o) {
    let foundUserByEmail
    // const filter = { email }
    const filter = { 'emails.primary': email, archived: o.archived }
    try {
      await client.connect()
      const db = client.db(DATABASE)
      const users = db.collection(COLLECTION)
      foundUserByEmail = await users.findOne(filter)
    } catch (err) {
      error('Exception during findByEmail')
      throw new Error(err.message)
    } finally {
      await client.close()
    }
    // If no user found by email, returned result is NULL.
    if (foundUserByEmail != null) {
      return foundUserByEmail
      // return new User({
      //   id: foundUserByEmail._id,
      //   type: foundUserByEmail.type,
      //   first_name: foundUserByEmail.first,
      //   last_name: foundUserByEmail.last,
      //   name: foundUserByEmail.name,
      //   username: foundUserByEmail.username,
      //   displayName: foundUserByEmail?.displayName,
      //   url: foundUserByEmail?.url,
      //   avatar: foundUserByEmail?.avatar,
      //   header: foundUserByEmail?.header,
      //   email: foundUserByEmail.email,
      //   emails: foundUserByEmail?.emails,
      //   hashedPassword: foundUserByEmail.hashedPassword,
      //   jwts: foundUserByEmail.jwts,
      //   keys: foundUserByEmail.keys,
      //   created_on: foundUserByEmail.createdOn,
      //   updated_on: foundUserByEmail.updatedOn,
      //   description: foundUserByEmail.description,
      //   sessionId: foundUserByEmail?.sessionId,
      //   schemaVer: foundUserByEmail?.schemaVer,
      //   archived: foundUserByEmail?.archived,
      // })
    }
    return foundUserByEmail
  }

  /**
   * Static class method to find user in the database, searching by ObjectId value.
   * @static
   * @async
   * @param {string} id - ObjectId value to search by in the database.
   * @param { Mongodbclient } _db - Connection to db if needed.
   * @param {object} o - Additional optional filtering values.
   * @return {Promise(<User>|null)} - Instance of User with properties populated.
   */
  static async findById(id, _db, o = {}) {
    let foundUserById
    const opts = { archived: false, ...o }
    try {
      await client.connect()
      const db = client.db(DATABASE)
      const users = db.collection(COLLECTION)
      foundUserById = await users.findOne({ _id: ObjectId(id), archived: opts.archived })
    } catch (err) {
      error(`Exception during findById(${id})`)
      error(err.message)
      throw new Error(err)
    } finally {
      // await client.close()
    }
    // If no user found by ObjectId(_id), returned result is NULL.
    if (foundUserById != null) {
      return foundUserById
      // return new User({
      //   id: foundUserById._id.toString(),
      //   type: foundUserById.type,
      //   first_name: foundUserById.first,
      //   last_name: foundUserById.last,
      //   name: foundUserById.name,
      //   username: foundUserById.username,
      //   displayName: foundUserById?.displayName,
      //   url: foundUserById?.url,
      //   avatar: foundUserById?.avatar,
      //   header: foundUserById?.header,
      //   email: foundUserById.email,
      //   emails: foundUserById?.emails,
      //   hashedPassword: foundUserById.hashedPassword,
      //   jwts: foundUserById.jwts,
      //   keys: foundUserById.keys,
      //   created_on: foundUserById.createdOn,
      //   updated_on: foundUserById.updatedOn,
      //   description: foundUserById.description,
      //   sessionId: foundUserByEmail?.sessionId,
      //   schemaVer: foundUserByEmail?.schemaVer,
      //   archived: foundUserByEmail?.archived,
      // })
    }
    return foundUserById
  }

  /**
   * @static
   * @async
   * @param {string} username - Find the single user with the username parameter.
   * @param {object} o - Additional optional filtering values.
   * @return {Promise(<User>|null} - Instance of a User with the properties populated.
   */
  static async findByUsername(username, o) {
    let foundUserByUsername
    try {
      await client.connect()
      const db = client.db(DATABASE)
      const users = db.collection(COLLECTION)
      foundUserByUsername = await users.findOne({ username, archived: o.archived })
    } catch (err) {
      error('Exception during findByUsername')
      throw new Error(err.message)
    } finally {
      await client.close()
    }
    if (foundUserByUsername !== null) {
      return foundUserByUsername
      // return new User({
      //   id: foundUserByUsername._id,
      //   type: foundUserByUsername.type,
      //   first_name: foundUserByUsername.first,
      //   last_name: foundUserByUsername.last,
      //   name: foundUserByUsername.name,
      //   email: foundUserByUsername.email,
      //   emails: foundUserByUsername?.emails,
      //   username: foundUserByUsername?.username,
      //   displayName: foundUserByUsername?.displayName,
      //   url: foundUserByUsername?.url,
      //   avatar: foundUserByUsername?.avatar,
      //   header: foundUserByUsername?.header,
      //   hashedPassword: foundUserByUsername.hashedPassword,
      //   jwts: foundUserByUsername.jwts,
      //   keys: foundUserByUsername.keys,
      //   created_on: foundUserByUsername.createdOn,
      //   updated_on: foundUserByUsername.updatedOn,
      //   desciption: foundUserByUsername.description,
      //   sessionId: foundUserByEmail?.sessionId,
      //   schemaVer: foundUserByEmail?.schemaVer,
      //   archived: foundUserByEmail?.archived,
      // })
    }
    return foundUserByUsername
  }

  /**
   * Static class method to find user in the database, searching by sessionId value.
   * @static
   * @async
   * @param {string} sessId - Current session ID of user as stored by redis.
   * @param {object} o - Additional optional filtering values.
   * @return {Promise(<User>|null} - Instance of a User with properties populated.
   */
  static async findBySessionId(sessId, o) {
    let foundUserBySessionId
    try {
      await client.connect()
      const db = client.db(DATABASE)
      const users = db.collection(COLLECTION)
      foundUserBySessionId = await users.findOne({ sessionId: sessId, archived: o.archived })
    } catch (err) {
      error('Exception during findBySessionId')
      throw new Error(err.message)
    } finally {
      await client.close()
    }
    if (foundUserBySessionId != null) {
      return foundUserBySessionId
      // return new User({
      //   id: foundUserBySessionId._id,
      //   type: foundUserBySessionId.type,
      //   first_name: foundUserBySessionId.first,
      //   last_name: foundUserBySessionId.last,
      //   name: foundUserBySessionId.name,
      //   email: foundUserBySessionId.email,
      //   emails: foundUserBySessionId?.emails,
      //   username: foundUserBySessionId?.username,
      //   displayName: foundUserBySessionId?.displayName,
      //   url: foundUserBySessionId?.url,
      //   avatar: foundUserBySessionId?.avatar,
      //   header: foundUserBySessionId?.header,
      //   hashedPassword: foundUserBySessionId.hashedPassword,
      //   jwts: foundUserBySessionId.jwts,
      //   keys: foundUserBySessionId.keys,
      //   created_on: foundUserBySessionId.createdOn,
      //   updated_on: foundUserBySessionId.updatedOn,
      //   description: foundUserBySessionId.description,
      //   sessionId: foundUserByEmail?.sessionId,
      //   schemaVer: foundUserByEmail?.schemaVer,
      //   archived: foundUserByEmail?.archived,
      // })
    }
    return foundUserBySessionId
  }

  /**
   * Stringifies the instance properties of the user, excluding and DB stuff.
   * @return {string} - A stringified version of a JSON literal of user properties.
   */
  toString() {
    return JSON.stringify({
      id: this._id,
      type: this._type,
      status: this._userStatus,
      first_name: this._first,
      last_name: this._last,
      full_name: this._name,
      emails: this._emails,
      username: this._username,
      displayName: this._displayName,
      url: this._url,
      avatar: this._avatar,
      header: this._header,
      // password: this._hashedPassword,
      jwts: this._jwts,
      created_on: this._created_on,
      updated_on: this._updated_on,
      description: this._description,
      sessionId: this._sessionId,
      schemaVer: this._schemaVer,
      archived: this._archived,
    }, null, 2)
  }

  /**
   * Stringifies the instance properties of the user, excluding and DB stuff.
   * @return {string} - A stringified version of a JSON literal of user properties.
   */
  serialize() {
    const propertiesToSerialize = ['_type', '_userStatus', '_first', '_last', '_name', '_emails', '_username', '_displayName', '_url', '_avatar', '_header', '_hashedPassword', '_created_on', '_updated_on', '_description', '_jwts', '_sessionId', '_schemaVer', '_archived']
    const that = this
    log(that._jwts)
    return JSON.stringify(that, propertiesToSerialize)
  }

  /**
   * Returns an array of the minimum required properties to instantiate a new user.
   */
  requiredProperties() {
    // this._requiredProperties = ['_first', '_last', '_email', '_emails', '_hashedPassword', '_jwts', '_type', '_userStatus']
    this._requiredProperties = ['_first', '_last', '_emails', '_hashedPassword', '_jwts', '_type', '_userStatus']
    return this._requiredProperties
  }

  /**
   * Sanity check to ensure all required properties have a value before saving the user.
   * @return {(boolean|Error)} - True or throws Error if missing any required properties.
   */
  checkRequired() {
    const missing = []
    const props = this.requiredProperties()
    props.forEach((key) => {
      if (!this[key] || this[key] === null || this[key] === 'undefined' || this[key] === '') {
        missing.push(key)
      }
    })
    if (missing.length > 0) {
      const msg = missing.map((item) => item.slice(1)).join(', ')
      throw new Error(`Missing the follwing required properties: ${msg}`)
    }
    return true
  }

  /**
   * Sanity check to ensure a valid database client connection object is present before
   * issuing any database queries.
   * @return {(boolean|Error)} - True or throws Error is client connection is not working.
   */
  checkDB() {
    const missing = []
    if (!this.dbClient || this.dbClient === null || this.dbClient === 'undefined') {
      missing.push('DB client connection object')
    }
    if (!this.dbDatabase || this.dbDatabase === null || this.dbDatabase === 'undefined') {
      missing.push('Database name')
    }
    if (!this.dbCollection || this.dbCollection === null || this.dbCollection === 'undefined') {
      missing.push('Collection name')
    }
    if (missing.length > 0) {
      const msg = missing.join(', ')
      throw new Error(`Missing the following required database properties: ${msg}`)
    }
    return true
  }

  /**
   * Performs an update on an existing user.  All user instance properties are sent
   * back to the database during the update.  Update query requires the user to have
   * a valid ObjectId value.
   * @async
   * @return {Promise(<UpdateResult>|Error)} - MongoDB UpdateResult object or throws an Error.
   */
  async update() {
    // Check required properties are all non-null values.
    // Throw an exception error back to the caller if not.
    log('1: Calling checkRequired()')
    this.checkRequired()
    // Check database client connection is available.
    // Throw an exception error back to the caller if not.
    this.checkDB()
    log('2: Calling checkDB()')
    let result
    try {
      await this.dbClient.connect()
      log('3: Calling dbClient.connect()')
      const database = this.dbClient.db(this.dbDatabase)
      const users = database.collection(this.dbCollection)
      log(`4: Setting update filter doc with ${this._id}`)
      const filter = { _id: this.objectId(this._id) }
      const update = {
        $set: {
          type: this._type,
          first: this._first,
          last: this._last,
          emails: this._emails,
          username: this._username,
          diplayName: this._displayName,
          url: this._url,
          avatar: this._avatar,
          header: this._header,
          publicDir: this._publicDir,
          privateDir: this._privateDir,
          hashedPassword: this._hashedPassword,
          jwts: this._jwts,
          keys: this._keys,
          updatedOn: Date.now(),
          description: this._description,
          userStatus: this._userStatus,
          sessionId: this._sessionId,
          schemaVer: this._schemaVer,
          archived: this._archived,
          // Mastodon fields
          locked: this._isLocked,
          bot: this._isBot,
          discoverable: this._isDiscoverable,
          group: this._isGroup,
          emojis: this._emojis,
          fields: this._fields,
          followers_count: this._followers_count,
          following_count: this._following_count,
        },
      }
      const options = { writeConcern: { w: 'majority' }, upsert: false, returnDocument: 'after', projection: { _id: 1, email: 1, first: 1 } }
      log('5: Calling findOneAndUpdate.')
      result = await users.findOneAndUpdate(filter, update, options)
      log(result)
    } catch (err) {
      if (err) {
        error('6: catch err', err)
      }
    } finally {
      await this.dbClient.close()
    }
    log('7: returning result')
    // return result
    return this
  }

  /**
   * Performs an insert of a new user.  All user instance properties are sent
   * to the database during the insert.  Insert query requires the user to have
   * a unique email address.
   * @async
   * @return {Promise(<User>|Error)} - A populated user instance or throws an Error.
   */
  async save() {
    // Check required properties are all non-null values.
    // Throw an exception error back to the caller if not.
    log('1: Calling checkRequired()')
    this.checkRequired()
    // Check database client connection is available.
    // Throw an exception error back to the caller if not.
    this.checkDB()
    log('2: Calling checkDB()')
    let result
    try {
      await this.dbClient.connect()
      log('3: Calling dbClient.connect()')
      const database = this.dbClient.db(this.dbDatabase)
      const users = database.collection(this.dbCollection)
      this._updated_on = Date.now()
      // Inserting a new user.
      log('5: This is a new user - insertOne.')
      const insert = {
        type: this._type,
        first: this._first,
        last: this._last,
        // email: this._email,
        emails: this._emails,
        username: this._username,
        displayName: this._displayName,
        url: this._url,
        avatar: this._avatar,
        header: this._header,
        hashedPassword: this._hashedPassword,
        jwts: this._jwts,
        keys: this._keys,
        createdOn: this._created_on,
        updatedOn: this._updated_on,
        userStatus: this._userStatus,
        description: this._description,
        sessionId: this._sessionId,
        schemaVer: this._schemaVer,
        archived: this._archived,
      }
      const options = { writeConcern: { w: 'majority' } }
      log('6: Calling insertOne.')
      result = await users.insertOne(insert, options)
      log('7: typeof result = ', typeof result)
      if (result?.insertedId != null) {
        // Get the newly creted ObjectId and assign it to this._id.
        // log('ObjectId: ', result.insertedId.toString())
        this._id = result.insertedId.toString()
      }
    } catch (err) {
      if (err) {
        error('8: catch err', err)
      }
    } finally {
      await this.dbClient.close()
    }
    log('9: returning the newly created ObjectId value')
    return this
  }

  /**
   * Id property setter.
   * @param {string} id - A value to be used as a valid ObjectId.
   */
  set id(id) {
    this._id = id
  }

  /**
   * Id proptery getter.
   * @return {string} - Current value to be used as a valid ObjectId.
   */
  get id() {
    return this._id
  }

  /**
   * Archived property setter.
   * @param {boolean} isArchived - A boolean value for whether account is archived or not.
   */
  set archived(isArchived) {
    this._archived = isArchived
  }

  /**
   * Archived property getter.
   * @return {boolean} - Current boolean value of user account archive status.
   */
  get archived() {
    return this._archived
  }

  /**
   * SCHEMA_VERSION currently used to define class properties.
   * @return {float}
   */
  get schemaVersion() {
    return this._schemaVer
  }

  /**
   * Password proptery setter.
   * @param {string} password - Value to be Bcyrpt hashed and salted.
   */
  set password(password) {
    // Have to, for now, rely on synchronous hash method
    // because it is awkward to use async/await promise here.
    let hashOrPassword
    if (/^\$2b\$10/.test(password)) {
      hashOrPassword = password
    } else if (password != null && password !== '') {
      hashOrPassword = bcrypt.hashSync(password, 10)
    }
    this._hashedPassword = hashOrPassword
  }

  /**
   * Password property getter.
   * @return {string} - Bcrypt hashed and salted password value.
   */
  get password() {
    return this._hashedPassword
  }

  /**
   * First name propety setter.
   * @param {string} first - User first name value.
   */
  set firstName(first) {
    this._first = first
    if (!this._name || this._name === null || this._name === 'undefined') {
      if (this._last != null && this._last !== 'undefined') {
        this._name = `${this._first} ${this._last}`
      }
    }
  }

  /**
   * First name property getter.
   * @return {string} - User first name value.
   */
  get firstName() {
    return this._first
  }

  /**
   * Last name propety setter.
   * @param {string} last - User last name value.
   */
  set lastName(last) {
    this._last = last
    if (!this._name || this._name === null || this._name === 'undefined') {
      if (this._first != null && this._first !== 'undefined') {
        this._name = `${this._first} ${this._last}`
      }
    }
  }

  /**
   * Last name property getter.
   * @return {string} - User last name value.
   */
  get lastName() {
    return this._last
  }

  /**
   * Alias for primary email address property setter.
   * @alias primaryEmail
   * @param {string} - User email address value.
   */
  set email(email) {
    this.primaryEmail = email
  }

  /**
   * Alias primary email address property getter.
   * @return {string} - User email address value.
   */
  get email() {
    return this._emails[0]
  }

  /**
   * Primary email address property setter.
   * @param {string} - User email address value.
   */
  set primaryEmail(email) {
    // this._email = email
    const re = new RegExp(`^${this._emails[1].secondary}$`)
    if (this._emails.length > 1 && re.test(email)) {
      error('Primary email must be different from the secondary email address.')
      throw new Error('Primary email must be different from the secondary email address.')
    } else {
      this._emails[0] = { primary: email, verified: false }
    }
  }

  /**
   * Primary email address property getter.
   * @return {string} - User email address value.
   */
  get primaryEmail() {
    return this._emails[0]
  }

  /**
   * Seconday email address property setter.
   * @param {string} - User email address value.
   */
  set secondaryEmail(email) {
    // this._email = email
    const n = this._emails.length
    const re = new RegExp(`^${this._emails[0].primary}$`)
    if (n === 0) {
      error('Missing required primary email address.')
      throw new Error('Missing required primary email address.')
    } else if (re.test(email)) {
      error('Secondary email must be different from the primary email address.')
      throw new Error('Secondary email must be different from the primary email address.')
    } else if (n === 1) {
      this._emails.push({ secondary: email, verified: false })
    } else {
      this._emails[1] = { secondary: email, verified: false }
    }
  }

  /**
   * Secondary email address property getter.
   * @return {string} - User email address value.
   */
  get secondaryEmail() {
    return this._emails[1]
  }

  /**
   * Array of at most two email addresses getter.
   * @return {Array) - List of email addresses.
   */
  get emails() {
    return this._emails
  }

  /**
   * Array of at most two email addresses setter.
   * @param {Array) - List of email addresses.
   */
  set emails(emails) {
    // this._emails = emails
    this.primaryEmail({ primary: emails[0], verified: false })
    this.secondaryEmail({ secondary: emails[1], verified: false })
  }

  /**
   * Username property setter.
   * @param {string} - New username value.
   */
  set username(username) {
    this.log('This is a bad design pattern.')
    this.log('Only set username this way if this.isUsernameAvailable() has already been called,')
    this.log('and has returned TRUE.')
    this._username = username
    this.log(`Side affect - update this.url to reflect new username ${username}`)
    this._url = `@${username}`
  }

  /**
   * Username property getter.
   * @return {string} - Username value.
   */
  get username() {
    return this._username
  }

  /**
   * Acct property setter (Mastodaon / Webfinger compatability).
   * @alias username
   * @param {string} - New acct value.
   */
  set acct(username) {
    // this._username = username
    this.log('noop - don\'t update acct / username values.')
  }

  /**
   * Acct property getter (Mastodaon / Webfinger compatability).
   * @alias username
   * @return {string} - Acct value.
   */
  get acct() {
    return this._username
  }

  /**
   * Url property setter (Mastodon compatability).
   * @param {string} - New url value.
   */
  set url(url) {
    let u = url
    if (url[0] !== '@') {
      u = `@${url}`
    }
    if (this._username === url) {
      this.log('noop')
    } else {
      this.log(`noop: trying to set this.url to ${u}`)
    }
  }

  /**
   * Url property getter (Mastodon compatability).
   * @return {string} - Url value.
   */
  get url() {
    return this._url
  }

  /**
   * Avatar url property setter (Mastodon compatability).
   * @param {string} url - New avatar url value.
   */
  set avatar(url) {
    this._avatar = url
  }

  /**
   * Avatar url property getter (Mastodon compatability).
   * @return {string} - Avatar url value.
   */
  get avatar() {
    return this._avatar
  }

  /**
   * Header image url property setter (Mastodon compatability).
   * @param {string} url - Header image url value.
   */
  set header(url) {
    this._header = url
  }

  /**
   * Header image url property getter (Mastodon compatability).
   * @return {string} - Header image url value.
   */
  get header() {
    return this._header
  }

  /**
   * Header image url property setter (Mastodon compatability).
   * @alias header
   * @param {string} url - Header image url value.
   */
  set headerStatic(url) {
    this._header = url
  }

  /**
   * Header image url property getter (Mastodon compatability).
   * @alias header
   * @return {string} - Header image url value.
   */
  get headerStatic() {
    return this._header
  }

  /**
   * Display name property setter.
   * @param {string} newDisplayName - User display name property value.
   */
  set displayName(newDisplayName) {
    this._displayName = newDisplayName
  }

  /**
   * Display name property getter.
   * @return {string} - User display name value.
   */
  get displayName() {
    if (!this._displayName || this._displayName === '' || this._displayName === 'undefined') {
      return `${this._first} ${this._last}`
    }
    return this._displayName
  }

  /**
   * Mastodon compatible display name getter.
   * @alias displayName()
   * @return {string} - User display name.
   */
  get display_name() {
    return this.displayName()
  }

  /**
   * Mastodon compatible display name setter.
   * @alias displayName()
   * @param {string} newDisplayName - User display name proptery value.
   * @return {undefined}
   */
  set display_name(newDisplayName) {
    this.displayName = newDisplayName
  }

  /**
   * Full name property setter.
   * @param {string} newName - User full name property value.
   */
  set name(newName) {
    this._name = newName
  }

  /**
   * Full name property getter.
   * @return {string} - User full name value.
   */
  get name() {
    if (!this._name || this._name === '' || this._name === 'undefined') {
      return `${this._first} ${this._last}`
    }
    return this._name
  }

  /**
   * JWT object property setter.
   * @param {object} tokens - Object literal containing JW Tokens.
   */
  set jwts(tokens) {
    this._jwts = tokens
  }

  /**
   * JTW object property getter.
   * @return {object} - User JWT object literal.
   */
  get jwts() {
    return this._jwts
  }

  /**
   * Public signing key getter.
   * @return {object}
   */
  get publicSigningKey() {
    return this.#psk()
  }

  async #psk() {
    let pem = null
    if (this._keys?.signing?.publicKey !== '') {
      try {
        const key = this._keys.signing.publicKey
        log(`Getting public signing key ${key}`)
        pem = await readFile(key)
        pem = pem.toString()
      } catch (e) {
        error(e)
      }
    }
    return pem
  }

  /**
   * Note property setter (alias to description - Mastodon compatability).
   * @param {string} note - User account note value.
   */
  set note(note) {
    this._description = note
  }

  /**
   * Note property getter(alias to description - Mastodon compatability).
   * @return {string} - User note property value.
   */
  get note() {
    return this._description
  }

  /**
   * Description property setter.
   * @param {string} description - User desciption value.
   */
  set description(description) {
    this._description = description
  }

  /**
   * Description property getter.
   * @return {string} - User description property value.
   */
  get description() {
    return this._description
  }

  /**
   * User type property setter.
   * @param {string} userType - User type property value.
   */
  set type(userType = 'User') {
    if (userType.toLowerCase() === 'admin') {
      this._type = 'Admin'
    } else {
      this._type = 'User'
    }
  }

  /**
   * User type property getter.
   * @return {string} - User type property value.
   */
  get type() {
    return this._type
  }

  /**
   * User status property setter.
   * @param {string} status - A value of either 'active' or 'inactive'.
   */
  set status(status) {
    this._userStatus = status
  }

  /**
   * User status property getter.
   * @return {string} - Current status of user.
   */
  get status() {
    return this._userStatus
  }

  /**
   * Mastodon compatibility - whether account manually approves follow requests.
   * @param {boolean} isLocked - User manually approves follow requests.
   * @return {undefined}
   */
  set locked(isLocked) {
    this._isLocked = isLocked
  }

  /**
   * Mastodon compatibility - does account manually approve follow requests?
   * @return {boolean}
   */
  get locked() {
    return this._isLocked
  }

  /**
   * Mastodon compatibility - Additional metadata attached to a profile as an array of name-value pairs.
   * @param {Object[]} field - name/value object literal (a.k.a field) or an array of name/value fields.
   * @return {undefined}
   */
  set fields(field) {
    if (Array.isArray(field)) {
      this._fields = field
    } else {
      this._fields.push(field)
    }
  }

  /**
   * Mastodon compatibility - Additional metadata fields attached to a profile.
   * @return {Object[]} - name/value object literal.
   */
  get fields() {
    return this._fields
  }

  /**
   * Mastodon compatibility - whether account is a bot or not.
   * @param {boolean} isBot - User account is a bot or not.
   * @return {undefined}
   */
  set bot(isBot) {
    this._isBot = isBot
  }

  /**
   * Mastodon compatibility - Is account a bot or not?
   * @return {boolean}
   */
  get bot() {
    return this._isBot
  }

  /**
   * Mastodon compatibility - whether account is a discoverable or not.
   * @param {boolean} isDiscoverable - User account is a discoverable or not.
   * @return {undefined}
   */
  set discoverable(isDiscoverable) {
    this._isDiscoverable = isDiscoverable
  }

  /**
   * Mastodon compatibility - Is account discoverable or not?
   * @return {boolean}
   */
  get discoverable() {
    return this._isDiscoverable
  }

  /**
   * Mastodon compatibility - Custom emoji entities to be used when rendering the profile.
   * @param {Array} emojis - Custom emoji entities to be used when rendering the profile.
   * @return {undefined}
   */
  set emojis(emojis) {
    if (Array.isArray(emojis)) {
      this._emojis.concat(emojis)
    } else {
      this._emojis = emojis
    }
  }

  /**
   * Mastodon compatibility - Custom emoji entities to be used when rendering the profile.
   * @return {Array}
   */
  get emojis() {
    return this._emojis
  }

  /**
   * Mastodon compatibility - whether account is a group actor or not.
   * @param {boolean} isGroup - User account is a group actor or not.
   * @return {undefined}
   */
  set group(isGroup) {
    this._isGroup = isGroup
  }

  /**
   * Mastodon compatibility - Is account is a group actor or not?
   * @return {boolean}
   */
  get group() {
    return this._isGroup
  }

  /**
   * Mastodon compatibility - The reported followers of this profile.
   * @param {number} followersCount - The reported followers of this profile.
   * @return {undefined}
   */
  set followers_count(followersCount) {
    this._followers_count = followersCount
  }

  /**
   * Mastodon compatibility - The reported followers of this profile?
   * @return {number}
   */
  get followers_count() {
    return this._followers_count
  }

  /**
   * Mastodon compatibility - The reported follows of this profile.
   * @param {number} followingCount - The reported follows of this profile.
   * @return {undefined}
   */
  set following_count(followingCount) {
    this._following_count = followingCount
  }

  /**
   * Mastodon compatibility - The reported followers of this profile?
   * @return {number}
   */
  get following_count() {
    return this._following_count
  }

  /**
   * User session ID property getter.
   * @return {string} - Current session ID of user.
   */
  get sessionId() {
    return this._sessionId
  }

  /**
   * User session ID property setter.
   * @param {string} sessionId - The current session ID stored in redis.
   */
  set sessionId(sessionId) {
    this._sessionId = sessionId
  }

  /**
   * Database client property setter.
   * @param {MongoClient} db -  User db connection property value.
   */
  set db(db) {
    this.dbClient = db
  }

  /**
   * Database client property getter.
   * @return {MongoClient} - User db connection proertery value.
   */
  get db() {
    return this.dbClient
  }

  /**
   * Check whether a username already exists in the database.
   * @summary Check whether a username already exists in the database.
   * @async
   * @param { string } - username to check in the database.
   * @throws { Error }
   * @return { Boolean }
   */
  async isUsernameAvailable(check = false) {
    if (!check) {
      error('Missing required username parameter.')
      throw new Error('Missing required username parameter.')
    }
    let isAvailable = false
    let username = check
    if (check[0] === '@') {
      username = check.slice(1)
    }
    try {
      await client.connect()
      const db = client.db(this.dbDatabase)
      const users = db.collection(this.dbCollection)
      const match = { username }
      const options = { projection: { _id: 1 } }
      const found = await users.findOne(match, options)
      log(found)
      if (!found) {
        isAvailable = true
      }
    } catch (e) {
      error(e)
      throw new Error(e)
    }
    return isAvailable
  }

  /**
   * publicDir proptery setter.
   * @param { string } location - Path to set user's publicDir location.
   * @return { undefined }
   */
  set publicDir(location) {
    if (!location) {
      error('Missing required location parameter.')
      throw new Error('Missing required location parameter.')
    }
    if (!this._ctx) {
      error('Missing koa ctx config values.')
      throw new Error('Missing koa ctx config values.')
    }
    let relPublicPath
    let fullPublicPath
    let relPrivatePath
    let fullPrivatePath
    const hashedId = createHash('md5').update(this._id.toString()).digest('hex')
    log(`hashedId ${hashedId}`)
    // Check to see if <location> contains the MD5 hashed user id field as part of path.
    // If not, add it so path looks like /path/to/koa-app-root/public/<location>/<hashedId>/
    const re = new RegExp(`${hashedId}`)
    if (!re.test(location)) {
      relPublicPath = `${location}/${hashedId}/`
      fullPublicPath = `${this._ctx.app.publicDir}/${location}/${hashedId}/`
      relPrivatePath = `${location}/${hashedId}/`
      fullPrivatePath = `${this._ctx.app.dirs.private.dir}/${location}/${hashedId}/`
    } else {
      relPublicPath = `${location}/`
      fullPublicPath = `${this._ctx.app.publicDir}/${location}/`
      relPrivatePath = `${location}/`
      fullPrivatePath = `${this._ctx.app.dirs.private.dir}/${location}/`
    }
    if (this._publicDir === null || this._publicDir === '') {
      // publicDir not set yet, create it now
      log(`Creating a new publicDir for ${this.emails[0].primary} at ${location}`)
      log(`Creating a new privateDir for ${this.emails[0].primary} at ${fullPrivatePath}`)
      log(`ctx.app.root: ${this._ctx.app.root}`)
      try {
        log(`public shortPath: ${relPublicPath}`)
        log(`public fullPath: ${fullPublicPath}`)
        this.makedir(fullPublicPath)
        this._publicDir = relPublicPath
      } catch (e) {
        const msg = `Failed setting ${this.emails[0].primary}'s publicDir ${fullPublicPath}.`
        error(msg)
        throw new Error(msg, { cause: e })
      }
      try {
        log(`private shortPath: ${relPrivatePath}`)
        log(`private fullPath: ${fullPrivatePath}`)
        this.privateDir = relPrivatePath
        // this.makedir(fullPrivatePath)
        // this._privateDir = relPrivatePath
      } catch (e) {
        const msg = `Failed setting ${this.emails[0].primary}'s privateDir ${fullPrivatePath}.`
        error(msg)
        throw new Error(msg, { cause: e })
      }
    } else {
      // renaming old publicDir to new name
      const oldFullPublicPath = `${this._ctx.app.publicDir}/${this.publicDir}`
      const newFullPublicPath = path.resolve(`${this._ctx.app.publicDir}`, `${location}`)
      const newRelPublicPath = `${location}/`
      log(`Renaming ${this.emails[0].primary}'s publicDir from ${oldFullPublicPath} to ${newFullPublicPath}`)
      // resolve the new path to the same root path...
      try {
        if (this.renamedir(newFullPublicPath)) {
          this._publicDir = newRelPublicPath
        }
      } catch (e) {
        const msg = `Failed to rename ${this.emails[0].primary}'s publicDir from ${oldFullPublicPath} to ${newFullPublicPath}`
        error(msg, { cause: e })
        throw new Error(e)
      }
      // renaming old privateDir to new name
      const oldFullPrivatePath = `${this._ctx.app.dirs.private.accounts}/${this._privateDir}`
      const newFullPrivatePath = path.resolve(`${this._ctx.app.dirs.private.accounts}`, `${location}`)
      const newRelPrivatePath = `${location}`
      log(`Renaming ${this.emails[0].primary}'s privateDir from ${oldFullPrivatePath} to ${newFullPrivatePath}`)
      try {
        if (this.renamedir(newFullPrivatePath)) {
          this._privateDir = newRelPrivatePath
        }
      } catch (e) {
        const msg = `Failed to rename ${this.emails[0].primary}'s privateDir from ${oldFullPrivatePath} to ${newFullPrivatePath}`
        error(msg)
        throw new Error(msg, { cause: e })
      }
    }
  }

  /**
   * publicDir property getter.
   * @return { string } - Directory location of user's publicDir.
   */
  get publicDir() {
    return this._publicDir
  }

  /**
   * privateDir property setter.
   * @param { string } location - Path to set user's privateDir location.
   * @return { undefined }
   */
  set privateDir(location) {
    if (location !== '') {
      try {
        this.makedir(`${this._ctx.app.dirs.private.dir}/${location}`)
        this._privateDir = location
      } catch (e) {
        error(`Failed setting ${this.emails[0].primary}'s privateDir`)
        throw new Error(`Failed setting ${this.emails[0].primary}'s privateDir`, { cause: e })
      }
    }
  }

  /**
   * privateDir property getter.
   * @return { string } - Directory location of users's privateDir.
   */
  get privateDir() {
    return this._privateDir
  }
}

export {
  User,
}
