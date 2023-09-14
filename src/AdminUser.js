/**
 * @module @mattduffy/users
 * @file: src/AdminUser.js
 */
import Debug from 'debug'
import { User } from './User.js'
import { ObjectId } from './mongoclient.js'

const debug = Debug('users:AdminUser')

/**
 * A class representing the Admin user model.  This class extends the basic User
 * model.  Admin specific methods and properties are provided here.
 * @summary A class defining the admin user model.
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @module @mattduffy/users
 */
class AdminUser extends User {
  /**
   * Create an admin user model and populate the properties.
   * @summary Create an admin user model and populate the properties.
   * @param { Object } config - An object literal with properties to pass new user to super to instantiate the base user model.
   * @param { MongoClient } db - A connected MongoDB client.
   * @param { Object } env - An object encapsulating the app's environmental variables.
   */
  constructor(config, db, env = {}) {
    debug('[AdminUser] DB credentials in use: %O', db?.client?.options?.credentials?.username)
    debug('[AdminUser] DB name in use: ', db?.client?.options?.dbName)
    super(config, db, env)
    this._type = 'Admin'
    // this.dbClient = db
    // this._description = 'This is an Admin level user.'
    debug('This is an Admin level user.')
    this._userTypes = [
      { type: 'Anonymous', description: 'This is an Anonymous level user.' },
      { type: 'User', description: 'This is a User level user.' },
      { type: 'Creator', description: 'This is an Creator level user.' },
      { type: 'Admin', description: 'This is an Admin level user.' },
    ]
    // debug(db)
  }

  /**
   * Static property used to compare with instanceof expressions.
   * @summary Static property used to compare with instanceof expressions.
   * @static
   * @typeOfUser { string }
   */
  static typeOfUser = 'Admin'

  /**
   * A static class method to check if a given user object is an Admin User.
   * @summary A static class method to check if a given user object is an Admin User.
   * @static
   * @param { Object } obj - Object to check instanceof against.
   * @param { string } obj.typeOfUser - Class property defining user type.
   * @return { boolean } - True if object checked is instance of AdminUser class.
   */
  static [Symbol.hasInstance](obj) {
    if (obj.typeOfUser === this.typeOfUser) return true
    return false
  }

  /**
   * Upgrade a user account to the next higher privilege level.
   * @summary Upgrade a user account to the next higher privilege level.
   * @static
   * @param { string } id - String value of ObjectId of the user to upgrade.
   * @return { boolean } - True if successful, false otherwise.
   */
  static async upgradeUser(id = null) {
    const wasSuccessful = false
    if (id === null) {
      throw new Error('A valid user id must be provided.')
    }
    this.checkDB()
    try {
      await this.dbClient.connect()
      debug('1: Calling dbClient.connect method')
      const database = this.dbClient.db(this.dbDatabase)
      const users = database.collection(this.dbCollection)
      /* eslint-disable no-unused-vars */
      const filter = { _id: this.objectId(id) }
      const options = {}
      const userToUpgrade = users.findOne({ _id: ObjectId(id) })
      /* eslint-enable no-unused-vars */
    } catch (error) {
      debug(error)
    } finally {
      await this.dbClient.close()
    }
    return wasSuccessful
  }

  /**
   * Query the database for all existing user accounts.
   * @summary Query the database for all existing user accounts.
   * @async
   * @param { Object } options - Options object to pass parameters for filtering results.
   * @throws { Error }
   * @return { Promise<Users[]> } - An array of users.
   */
  async listUsers(options = {}) {
    this.checkDB()
    let typeFilter
    if (!options?.userTypes) {
      typeFilter = ['Admin', 'Creator', 'User']
    }
    let userList
    try {
      await this.dbClient.connect()
      debug('1: Calling dbClient.connect method ')
      const database = this.dbClient.db(this.dbDatabase)
      const users = database.collection(this.dbCollection)
      const pipeline = []
      /* eslint-disable quote-props */
      const unwind = {
        '$unwind': {
          'path': '$emails',
        },
      }
      const group = {
        '$group': {
          '_id': '$userStatus',
          'count': { '$sum': 1 },
          'users': { '$push': { 'id': '$_id', 'primary_email': '$emails.primary', 'name': '$first' } },
        },
      }
      const match = {
        '$match': {
          '_id.type': { '$in': typeFilter },
        },
      }
      /* eslint-enable quote-props */
      pipeline.push(unwind)
      pipeline.push(group)
      pipeline.push(match)
      userList = await users.aggregate(pipeline).toArray()
    } catch (error) {
      debug(error)
    } finally {
      await this.dbClient.close()
    }
    // userList = userList.toArray()
    return userList
  }

  /**
   * Query the database for all users by type.
   * @summary Query the database for all users by type.
   * @async
   * @param { string } type - User type to query by.
   * @throws { Error }
   * @return { Promise<Users[]> } - An array of users.
   */
  async getUsersByType(type = 'all') {
    debug(`What is going on with the <type> param? ${type}`)
    if (type === null || type === '' || type === 'undefined') {
      throw new Error('A valid user type was not supplied.')
    }
    this.checkDB()
    let userList
    let match
    try {
      await this.dbClient.connect()
      const database = this.dbClient.db(this.dbDatabase)
      const users = database.collection(this.dbCollection)
      const pipeline = []
      /* eslint-disable quote-props */
      const unwind = {
        '$unwind': {
          'path': '$emails',
        },
      }
      pipeline.push(unwind)
      if (/all/i.test(type)) {
        match = { '$match': { type: { '$exists': true } } }
      } else {
        const userType = type[0].toUpperCase() + type.slice(1)
        match = { '$match': { type: userType } }
      }
      // debug('match: %O', match)
      pipeline.push(match)
      const group = {
        '$group': {
          _id: '$type',
          count: { '$sum': 1 },
          users: { '$push': { id: '$_id', primary_email: '$emails.primary', name: '$first', status: '$userStatus' } },
        },
      }
      /* eslint-enable-next-line quote-props */
      // debug('group: %O', group)
      pipeline.push(group)
      // debug('pipeline: %O', pipeline, { depth: null })
      // console.dir(pipeline,  { depth: null })
      userList = await users.aggregate(pipeline).toArray()
      console.dir(userList)
    } catch (error) {
      debug(error)
    } finally {
      await this.dbClient.close()
    }
    return userList
  }

  /**
   * Delete a user from the database, identified by either id or email address.
   * @summary Delete a user from the database, identified by either id or email address.
   * @async
   * @param { string } id - String value of an ObjectId
   * @param { string } email = String value of an email address.
   * @return { Promise<boolean> } - True if delete is successful, false if not.
   */
  async deleteUser(id = null, email = null) {
    if (id === null && email === null) {
      throw new Error('Either an id or email address are required.')
    }
    this.checkDB()
    let deleteSuccessful
    let deleteFilter
    try {
      debug('1: Calling dbClient.connect()')
      await this.dbClient.connect()
      const database = this.dbClient.db(this.dbDatabase)
      const users = database.collection(this.dbCollection)
      if (id != null && id !== '') {
        deleteFilter = { _id: this.objectId(id) }
      }
      if (email != null && email !== '') {
        deleteFilter = { email }
      }
      deleteSuccessful = await users.deleteOne(deleteFilter)
    } catch (error) {
      debug(error)
    } finally {
      await this.dbClient.close()
    }
    // If no delete occurred: deleteSuccessful.deletedCount: 0
    return deleteSuccessful
  }
}

export {
  AdminUser,
}
