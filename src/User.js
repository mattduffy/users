/**
 * @module @mattduffy/users
 * @file /src/User.js
 */
import { mkdir, stat, rename } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import bcrypt from 'bcrypt'
import Debug from 'debug'
import { client, ObjectId } from './mongoclient.js'

const log = Debug('users:User')
const error = Debug('users:User_error')
const Database = 'mattmadethese'
const Collection = 'users'

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
    this._url = config?.url ?? `http://<<app.host>>/@${this._username}`
    this._url = this.#fixUsernameUrl(this._url)
    this._avatar = config?.avatar ?? config?._avatar ?? 'http://<<app.host>>/i/accounts/avatars/missing.png'
    this._avatar = this.#fixAvatarUrl(this._avatar)
    this._header = config?.header ?? config?._header ?? 'http://<<app.host>>/i/accounts/headers/generic.png'
    this._header = this.#fixHeaderUrl(this._header)
    this._jwts = config?.jwts ?? null
    this._created_on = config?.createdOn ?? config?.created_on ?? Date.now()
    this._updated_on = config?.updatedOn ?? config?.updated_on ?? null
    this._description = config?.description ?? 'This is a user.'
    this._userStatus = config?.status ?? config?.userStatus ?? 'inactive'
    this._publicDir = config?.publicDir ?? null
    this._sessionId = config?.sessionId ?? null
    this._schemaVer = config?.schemaVer
  }

  /**
   *
   */
  #fixHeaderUrl(url) {
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
    const filter = { email }
    const options = { projection: { hashedPassword: 1 } }
    let result
    try {
      await client.connect()
      const db = client.db(Database)
      const users = db.collection(Collection)
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
   * Simple class method wrapper around fs/promises.rename function.
   * @summary Simple class method wrapper around fs/promises.rename function.
   * @async
   * @param { string } directory - Path of directory to be renamed.
   * @return { undefined }
   * @throws { Error } If directory argument is missing or doesn't already exists.
   */
  /* eslint-disable-next-line class-methods-use-this */
  async renamedir(newName) {
    try {
      await rename(this.publicDir, newName)
      return true
    } catch (e) {
      error(`Failed to rename ${this.publicDir} to ${newName}`)
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
   * @return { Promise(<User>|null) } - Instance of User with properties populated.
   */
  static async findByEmail(email) {
    let foundUserByEmail
    // const filter = { email }
    const filter = { 'emails.primary': email }
    try {
      await client.connect()
      const db = client.db(Database)
      const users = db.collection(Collection)
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
      //   created_on: foundUserByEmail.createdOn,
      //   updated_on: foundUserByEmail.updatedOn,
      //   description: foundUserByEmail.description,
      //   sessionId: foundUserByEmail?.sessionId,
      //   schemaVer: foundUserByEmail?.schemaVer,
      // })
    }
    return foundUserByEmail
  }

  /**
   * Static class method to find user in the database, searching by ObjectId value.
   * @static
   * @async
   * @param {string} id - ObjectId value to search by in the database.
   * @return {Promise(<User>|null)} - Instance of User with properties populated.
   */
  static async findById(id) {
    let foundUserById
    try {
      await client.connect()
      const db = client.db(Database)
      const users = db.collection(Collection)
      foundUserById = await users.findOne({ _id: ObjectId(id) })
    } catch (err) {
      error('Exception during findById')
      throw new Error(err.message)
    } finally {
      await client.close()
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
      //   created_on: foundUserById.createdOn,
      //   updated_on: foundUserById.updatedOn,
      //   description: foundUserById.description,
      //   schemaVer: foundUserById?.schemaVer,
      //   sessionId: foundUserById.sessionId,
      // })
    }
    return foundUserById
  }

  /**
   * @static
   * @async
   * @param {string} username - Find the single user with the username parameter.
   * @return {Promise(<User>|null} - Instance of a User with the properties populated.
   */
  static async findByUsername(username) {
    let foundUserByUsername
    try {
      await client.connect()
      const db = client.db(Database)
      const users = db.collection(Collection)
      foundUserByUsername = await users.findOne({ username })
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
      //   created_on: foundUserByUsername.createdOn,
      //   updated_on: foundUserByUsername.updatedOn,
      //   desciption: foundUserByUsername.description,
      //   schemaVer: foundUserByUsername?.schemaVer,
      //   sessionId: foundUserByUsername?.sessionId,
      // })
    }
    return foundUserByUsername
  }

  /**
   * Static class method to find user in the database, searching by sessionId value.
   * @static
   * @async
   * @param {string} sessId - Current session ID of user as stored by redis.
   * @return {Promise(<User>|null} - Instance of a User with properties populated.
   */
  static async findBySessionId(sessId) {
    let foundUserBySessionId
    try {
      await client.connect()
      const db = client.db(Database)
      const users = db.collection(Collection)
      foundUserBySessionId = await users.findOne({ sessionId: sessId })
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
      //   created_on: foundUserBySessionId.createdOn,
      //   updated_on: foundUserBySessionId.updatedOn,
      //   description: foundUserBySessionId.description,
      //   schemaVer: foundUserBySessionId?.schemaVer,
      //   sessionId: foundUserBySessionId?.sessionId,
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
      description: this._description,
      created_on: this._created_on,
      updated_on: this._updated_on,
      sessionId: this._sessionId,
      schemaVer: this._schemaVer,
      jwts: this._jwts,
    }, null, 2)
  }

  /**
   * Stringifies the instance properties of the user, excluding and DB stuff.
   * @return {string} - A stringified version of a JSON literal of user properties.
   */
  serialize() {
    const propertiesToSerialize = ['_type', '_first', '_last', '_name', '_emails', '_username', '_displayName', '_url', '_avatar', '_header', '_hashedPassword', '_created_on', '_updated_on', '_description', '_jwts', '_sessionId', '_schemaVer']
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
    for(const key of this.requiredProperties()) {
      if (!this[key] || this[key] === null || this[key] === 'undefined' || this[key] === '') {
        missing.push(key)
      }
    }
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
          // email: this._email,
          emails: this._emails,
          username: this._username,
          diplayName: this._displayName,
          url: this._url,
          avatar: this._avatar,
          header: this._header,
          publicDir: this._publicDir,
          hashedPassword: this._hashedPassword,
          jwts: this._jwts,
          // createdOn: this._created_on,
          updatedOn: Date.now(),
          description: this._description,
          userStatus: this._userStatus,
          sessionId: this._sessionId,
          schemaVer: this._schemaVer,
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
        createdOn: this._created_on,
        updatedOn: this._updated_on,
        description: this._description,
        userStatus: this._userStatus,
        sessionId: this._sessionId,
        schemaVer: this._schemaVer,
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
    // return this._id
    // return result
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
    this._username = username
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
    const re = new RegExp(`^https://[^\\s][A-Za-z0-9._-]+/@${this._username}`)
    if (re.test(`${url}/@${this._username}`)) {
      log(`${url}/@${this._username}`)
      this._url = `${url}/@${this._username}`
    } else {
      this._url = url
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
   * @return {Object} - User JWT object literal.
   */
  get jwts() {
    return this._jwts
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
   * publicDir proptery setter.
   * @param { string } - Path to set user's publicDir location.
   */
  set publicDir(location) {
    if (!location) {
      error('Missing required location parameter.')
      throw new Error('Missing required location parameter.')
    }
    if (this._publicDir === null || this._publicDir === '') {
      // publicDir not set yet, create it now
      log(`Creating a new publicDir for ${this.emails[0].primary} at ${location}`)
      let pubDirPath
      const hashedId = createHash('md5').update(this._id.toString()).digest('hex')
      log(`hashedId ${hashedId}`)
      // Check to see if <location> contains the MD5 hashed user id field as part of path.
      // If not, add it so path looks like /path/to/koa-app-root/public/<location>/<hashedId>/
      const re = new RegExp(`${hashedId}`)
      if (!re.test(location)) {
        // pubDirPath = path.resolve(location, 'accounts', hashedId)
        pubDirPath = `${location}/${hashedId}`
      } else {
        pubDirPath = location
      }
      try {
        this.makedir(pubDirPath)
      } catch (e) {
        error(`Failed setting ${this.email}'s publicDir.`)
        throw new Error(`Failed setting ${this.emails[0].primary}'s publicDir.`)
      }
      log(`pubDirPath ${pubDirPath}`)
      log(`pubDirPath resolved ${path.resolve(pubDirPath)}`)
      this._publicDir = pubDirPath
    } else {
      // renaming old publicDir to new name
      const oldPath = path.resolve(this.publicDir)
      const newPath = path.resolve(location)
      log(`Renaming ${this.emails[0].primary}'s publicDir from ${oldPath} to ${newPath}`)
      // resolve the new path to the same root path...
      try {
        if (this.renamedir(newPath)) {
          this.publicDir = newPath
        }
      } catch (e) {
        error(`Failed to rename ${this.emails[0].primary}'s publicDir from ${oldPath} to ${newPath}`)
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
}

export {
  User,
}
