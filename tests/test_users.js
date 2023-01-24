//require('dotenv').config()
import dotenv from 'dotenv'
dotenv.config()
//const debug = require('debug')('users:test_users')
import Debug from 'debug'
const debug = Debug('users:test_users')
//const Users = require('../Users.js')
import Users from '../Users.js'
//const {client, genTokens} = require('./db_connection_test.js')
import { client, getTokens } from './db_connection_test.js'

;(async () => {
  debug('Starting basic user account tests...');
  let properties = {
    first_name: '1234567890',
    last_name: 'slkjdlafjd',
    email: 'matt@mattmail.email',
    password: '9@zzw0rd',
    jwts: genTokens()
  };
  debug('BasicUser created properties object')
  debug('BasicUser calling Users.newUser static method with mongodb client obj and user properties obj.')
  // let basicUser = Users.newUser(client, properties)
  let basicUser = Users.newUser(properties)
  debug('BasicUser basicUser.toString: ', basicUser.toString())
  debug('BasicUser calling save() method on the new user.');

  // let result = await basicUser.save( )
  basicUser = await basicUser.save( )
  debug('BasicUser result of save() call.' )
  debug('BasicUser result: ', basicUser.toString() )
  debug('BasicUser result.insertedId.toString: ', basicUser.id )
  
  debug('***********************************************' )
  debug('***********************************************' )
  debug('BasicUser Can we update this newly created basic user now?' )
  basicUser.email = 'mail@electronic-mail.commercial'
  basicUser = await basicUser.update( )
  debug('BasicUser updated basic user: ', basicUser.toString() )

  debug('***********************************************' )
  debug('***********************************************' )
  debug('UserByEmail Can we find a user by email address?')
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
  debug('UserByEmail Can we find a user by id %s ?', id)
  try {
    userById = await Users.findById( id )
  } catch (e) {
    debug(e)
  }
  debug('UserById Found user: %O', userById.toString())

  debug('***********************************************' )
  debug('***********************************************' )
  debug('UserById Can we compare password with hashedPassword?')
  let passwordsTheSame
  debug('COMPARE About to cmp properties.password: \'%s\' and userById.password: \'%s\'', properties.password, userById.password)
  passwordsTheSame = await Users.cmpPassword( userById.email, properties.last_name)
  if(passwordsTheSame) {
    debug('COMPARE Samesies')
  } else {
    debug('COMPARE different')
  }

  debug('Starting Admin User account tests...');
  debug('***********************************************' )
  debug('***********************************************' )
  debug('Can we create an Admin User?')
  let adminProperties = {
    first_name: 'Adam',
    last_name: 'TheAdmin',
    email: 'adam@theadmin.email',
    password: '9@zzw0rd',
    jwts: genTokens()
  }
  debug('AdminUser created properties object')
  debug('AdminUser calling Users.newAdminUser static method with mongodb client obj and user properties obj.')
  let adminUser = await Users.newAdminUser( adminProperties )
  debug('AdminUser AdminUser.toString: ', adminUser.toString())
  debug('AdminUser calling the save() method on the new user.');

  adminUser = await adminUser.save( )
  debug('AdminUser result of save() call.' )
  debug('AdminUser result: ', adminUser.toString() )
  debug('AdminUser result.insertedId.toString: ', adminUser.id )



 })();

