require('dotenv').config({ path: './.env' })
const debug = require('debug')('users:test.AdminUser')
const Users = require('../Users.js')
const AdminUser = require('../AdminUser.js')
const {client, genTokens} = require('./db_connection_test.js')
const crypto = require('crypto')

function r(n) { return crypto.randomBytes(n).toString('hex') }
function h() { if(Math.floor((Math.random()*10)) % 2 === 1) { return 'inactive' } else { return 'active' } }

(async () => {
    
  debug('Starting the Admin User model tests...')
  let AdminProperties = {
    first_name: 'Arnold-'+r(1),
    last_name: 'Admonsterator',
    email: 'arnold@admin.'+r(2),
    password: process.env.TEST_PASSWORD,
    jwts: genTokens(),
    status: h()
  };
  let adminUser = Users.newAdminUser(AdminProperties)
  debug('AdminUser created properties object')
  debug('AdminUser calling Users.newUser static method with mongodb client obj and user properties obj.')
  debug('AdminUser adminUser.toString: ', adminUser.toString())
  debug('AdminUser calling save() method on the new user.');
  debug('AdmimUser: is instance of? ', adminUser instanceof AdminUser)
  let saveResult = await adminUser.save()

  debug('AdminUser result of save() call.' )
  debug('AdminUser result: %O', saveResult )
  // debug('AdminUser result.insertedId.toString: ', adminUser.id )
  debug('') 
  debug('***********************************************' )
  debug('***********************************************' )
  debug('AdminUser Can we update this newly created admin user now?' )

  let aString = adminUser.toString()
  debug(aString)
  debug('AdminUser.email: ', adminUser.email)
  let email = adminUser.email
  email = email.slice(0, email.length - 4)
  email = email + r(2)
  adminUser.email = email
  debug('AdminUser.email new: ', email)
  let updateResult = await adminUser.update( )
  debug('AdminUser result of update() call ')
  debug('AdminUser result %O', updateResult?.value )
  debug('') 
  debug('***********************************************' )
  debug('***********************************************' )
  debug('AdminUser Can we list all existing user accounts?' )
  debug('AdminUser is this still an admin user?', adminUser instanceof AdminUser)
  debug('') 
  let userArray = await adminUser.listUsers()
  debug('Is result an array?', userArray instanceof Array)
  let numUsers = userArray.length
  debug('Length of result array: ', numUsers)
  if (numUsers <= 1) {
    debug('userArray (length 1 - no users returned)', userArray)
  } else {
    debug(userArray[0]?._id, userArray[0]?.users[0].email)
    debug(userArray[1]?._id, userArray[1]?.users[0].email)
  }
  debug('') 
  debug('***********************************************' )
  debug('***********************************************' )
  debug('AdminUser Can we delete an existing user account?')
  let userIdToDelete = userArray[0].users[0].id
  let userEmailToDelete = userArray[0].users[0].email
  debug('Attempting to delete %s (%s)', userIdToDelete, userEmailToDelete)
  let deletedUser = await adminUser.deleteUser(userIdToDelete)
  debug(deletedUser)

  
})();
