/**
 * @module @mattduffy/users
 */
import Debug from 'debug'
import { User } from './User.js'

const debug = Debug('users:AnonymousUser')

/**
 * @todo [ ] - Create a test to authenticate user accounts base on permissions.
 * @todo [ ] -
 */

/**
 * A class representing the Anonymous user model.  This class extends basic User
 * model.  Admin specific methods and properties are provided here.
 * @summary A class defining the anonymous user model.
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @module @mattduffy/users
 */
class AnonymousUser extends User {
  /**
   * Create an admin user model and populate the properties.
   * @summary Create an admin user model and populate the properties.
   * @param { Object } config - An object literal with properties to pass new user to super to instantiate the base user model.
   */
  constructor(config, db, env = {}) {
    super(config, db, env)
    this._type = 'Anonymous'
    // this._description = 'This is an Anonymous user.'
    debug('This is an Anonymous user.')
  }

  /**
   * Static property used to compare with instanceof expressions.
   * @summary Static property used to compare with instanceof expressions.
   * @static
   * @typeOfUser { string }
   */
  static typeOfUser = 'Anonymous'

  /**
   * A static class method to check if a given user object is a Anonymous User.
   * @summary A static class method to check if a given user object is a Anonymous User.
   * @static
   * @param { Object } obj - Object to check instanceof against.
   * @param { string } obj.typeOfUser - Class property defining user type.
   * @return {boolean} - True if object checked is instance of AnonymousUser class.
   */
  static [Symbol.hasInstance](obj) {
    if (obj.typeOfUser === this.typeOfUser) return true
    return false
  }
}

export {
  AnonymousUser,
}
