/**
 * @module @mattduffy/users
 */
import Debug from 'debug'
import { AnonymousUser } from './AnonymousUser.js'

const debug = Debug('users:CreatorUser')

/**
 * A class representing the Creator user model.  This class extends Anonymous
 * Use rmodel.  Creator specific methods and properties are provided here.
 * @summary A class defining the creator user model.
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @module @mattduffy/users
 */
class CreatorUser extends AnonymousUser {
  /**
   * Create a creator user model and populate the properties.
   * @summary Create a creator user model and populate the properties.
   * @param { Object } config - An object literal with properties to pass new user to super to instantiate the base user model.
   * @param { MongoClient } db - A connected MongoDB client.
   * @param { Object } env - An object encapsulating the app's environmental variables.
   */
  constructor(config, db, env = {}) {
    debug('[CreatorUser] DB credentials in use: %O', db?.client?.options?.credentials?.username)
    debug('[CreatorUser] DB name in use: ', db?.client?.options?.dbName)
    super(config, db, env)
    this._type = 'Creator'
    // this._description = 'This is a Creator user.'
    debug('This is a Creator user.')
  }

  /**
   * Static property used to compare with instanceof expressions.
   * @summary Static property used to compare with instanceof expressions.
   * @static
   * @typeOfUser { string }
   */
  typeOfUser = 'CreatorUser'

  /**
   * A static class method to check if a given user object is a Creator User.
   * @summary A static class method to check if a given user object is a Creator User.
   * @static
   * @param { Object } obj - Object to check instanceof against.
   * @param { string } obj.typeOfUser - Class property defining user type.
   * @return { boolean } - True if object checked is instance of CreatorUser class.
   */
  static [Symbol.hasInstance](obj) {
    if (obj.typeOfUser === this.typeOfUser) return true
    return false
  }
}

export {
  CreatorUser,
}
