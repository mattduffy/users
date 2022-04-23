require('dotenv').config({ path: './.env' })
const debug = require('debug')('users:test.AdminUser')
const Users = require('../Users.js')
const AdminUser = require('../AdminUser.js')
const {client, genTokens} = require('./db_connection_test.js')
const crypto = require('crypto')

function r(n) {return crypto.randomBytes(n).toString('hex')}

(async () => {
    
  debug('Starting the Admin User model tests...')
  let AdminProperties = {
    first_name: 'Arnold-'+r(1),
    last_name: 'Admonsterator',
    email: 'arnold@admin.'+r(2),
    password: process.env.TEST_PASSWORD,
    jwts: genTokens()
  };
  let adminUser = Users.newAdminUser(AdminProperties)
  debug('AdminUser created properties object')
  debug('AdminUser calling Users.newUser static method with mongodb client obj and user properties obj.')
  debug('AdminUser adminUser.toString: ', adminUser.toString())
  debug('AdminUser calling save() method on the new user.');
  debug('AdmimUser: is instance of? ', adminUser instanceof AdminUser)
  adminUser = await adminUser.save()

  debug('AdminUser result of save() call.' )
  debug('AdminUser result: %O', adminUser.toString() )
  debug('AdminUser result.insertedId.toString: ', adminUser.id )
  
  debug('***********************************************' )
  debug('***********************************************' )
  debug('AdminUser Can we update this newly created admin user now?' )

  adminUser.toString()

  debug('AdminUser.email: ', adminUser.email)
  let email = adminUser.email
  email = email.slice(0, email.length - 4)
  email = email + r(2)
  adminUser.email = email
  debug('AdminUser.email new: ', email)
  adminUser = await adminUser.update( )
  debug('AdminUser updated admin user: ', adminUser.toString() )



})();
