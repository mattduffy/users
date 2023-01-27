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
   * @param {Object} config - An object literal with properties to pass new user
   * to super to instantiate the base user model.
   */
  constructor(config) {
    super(config)
    this._type = 'Anonymous'
    this._description = 'This is an Anonymous user.'
    debug(this._description)
  }

  /**
   * Static property used to compare with instanceof expressions.
   * @static
   * @type {string}
   */
  static type = 'Anonymous'

  /**
   * A static class method to check if a given user object is a Anonymous User.
   * @static
   * @param {object} obj - Object to check instanceof against.
   * @return {boolean} - True if object checked is instance of AnonymousUser class.
   */
  static [Symbol.hasInstance](obj) {
    if (obj.type === this.type) return true
    return false
  }
}

export {
  AnonymousUser,
}
