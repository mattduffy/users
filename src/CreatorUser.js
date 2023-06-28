/**
 * @module @mattduffy/users
 */
import Debug from 'debug'
import { AnonymousUser } from './AnonymousUser.js'

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
   * @summary Create a creator user model and populate the properties.
   * @param { Object } config - An object literal with properties to pass new user to super to instantiate the parent anonymous model.
   */
  constructor(config) {
    super(config)
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
