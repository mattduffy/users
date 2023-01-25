/**
 * @module @mattduffy/users
 */
import Debug from 'debug'
import { AnonUser as AnonymousUser } from './AnonymousUser.js'

const debug = Debug('users:CreatorUser')

/**
 * @todo [ ] Create a test to authenticate user accounts base on permissions.
 * @todo [ ] Create creator method - creeatAlbum.
 * @todo [ ] Create creator method - deleteAlbum.
 * @todo [ ] Create creator method - updateAlbum.
 * @todo [ ] Create creator methods - hideAlbum / showAlbum.
 * @todo [ ] Create creator methods - makeAlbumPrivate / makeAlbumPublic.
 * @todo [ ] Create creator methods - makeAlbumShareLink / deleteAlbumShareLink.
 * @todo [ ]
 */

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
   * @param {Object} config - An object literal with properties to pass new user
   * to super to instantiate the parent anonymous model.
   */
  constructor(config) {
    super(config)
    this._type = 'Creator'
    this._description = 'This is a Creator user.'
    debug(this._description)
  }

  /**
   * Static property used to compare with instanceof expressions.
   * @static
   * @type {string}
   */
  static type = 'Creator'

  /**
   * A static class method to check if a given user object is a Creator User.
   * @static
   * @param {object} obj - Object to check instanceof against.
   * @return {boolean} - True if object checked is instance of CreatorUser class.
   */
  static [Symbol.hasInstance](obj) {
    if (obj.type === this.type) return true
    return false
  }
}

export {
  CreatorUser,
}
