require('dotenv').config()
const debug = require('debug')('users:test_users')
const Users = require('../Users.js')
const {client, genTokens} = require('./db_connection_test.js')

debug('&, starting tests.')
let properties = {
  first_name: '1234567890',
  last_name: 'slkjdlafjd',
  email: 'matt@mattmail.email',
  password: '9@zzw0rd',
  jwts: genTokens()
}
debug('created properties object')
debug('calling Users.newUser static method with mongodb client obj and user properties obj.')
// let basicUser = Users.newUser(client, properties)
let basicUser = Users.newUser(properties)
debug('basicUser.toString: ', basicUser.toString())
debug('calling save() method on the new user.');

(async () => {
  // let result = await basicUser.save( )
  basicUser = await basicUser.save( )
  debug('result of save() call.' )
  debug('result: ', basicUser.toString() )
  debug('result.insertedId.toString: ', basicUser.id )
  
  debug('***********************************************' )
  debug('***********************************************' )
  debug('Can we update this newly created basic user now?' )
  basicUser.email = 'mail@electronic-mail.commercial'
  basicUser = await basicUser.update( )
  debug('updated basic user: ', basicUser.toString() )

  debug('***********************************************' )
  debug('***********************************************' )
  debug('Can we find a user by email address?')
  let userByEmail;
  try {
    userByEmail = await Users.findByEmail( 'mail@electronic-mail.commercial' )
  } catch (e) {
    debug(e)
  }
  debug('%O', userByEmail.toString())

  debug('***********************************************' )
  debug('***********************************************' )
  let id = userByEmail.id
  let userById
  debug('Can we find a user by id %s ?', id)
  try {
    userById = await Users.findById( id )
  } catch (e) {
    debug(e)
  }
  debug('Found user: %O', userById.toString())
})();


