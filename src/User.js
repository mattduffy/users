/**
 * @module @mattduffy/users
 * @file /src/User.js
 */
import Debug from 'debug'
import bcrypt from 'bcrypt'
import path from 'node:path'
import { rename } from 'node:fs'
import { stat, writeFile, readFile, mkdir } from 'node:fs/promises'
import { createHash, subtle } from 'node:crypto'
import { ulid } from 'ulid'
import { client, ObjectId } from './mongoclient.js'

const log = Debug('users:User')
const error = Debug('users:User_error')
// const DATABASE = process.env.MONGODB_DBNAME ?? 'koastub'
const COLLECTION = 'users'

/**
 * A class representing the basic user model.  This class contains the generic
 * properties and methods necessary to create a simple application user.
 * Methods include saveing/updating properties, comparing password for
 * authentication and handler for verifying JWTs.
 * @summary A class defining a basic user model.
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @module @mattduffy/users
 */
class User {
  SCHEMA_VERSION = 4

  /**
   * Class property set to an Array of Object literals containing email addresses.
   */
  _emails

  /**
   * Create a user model and populate the properties.
   * @param { Object } config - An object literal with properties to initialize new user.
   */
  constructor(config, db) {
    this.log = log
    this.objectId = ObjectId
    // this.dbClient = config?.client ?? client
    this.dbClient = db?.client ?? client
    this.dbDatabase = config?.dbName ?? process.env.MONGODB_DBNAME ?? 'koastub'
    this.dbCollection = 'users'
    this.jwt = config.jwt
    this._ctx = config?.ctx ?? {}
    this._id = config?._id ?? config?.id ?? null
    this._type = config?.type ?? 'User'
    this._first = config?.first_name ?? config?.first ?? null
    this._last = config?.last_name ?? config?.last ?? null
    // this._email = config?.email ?? ''
    this._emails = config?.emails ?? []
    this._hashedPassword = null
    this.password = config?.password ?? config.hashedPassword
    let fullName
    if (config.name != null && config.name !== '') {
      fullName = config.name
    } else if (this._first != null && this._last != null) {
      fullName = `${this._first} ${this._last}`
    }
    this._name = fullName ?? null
    this._username = config?.username ?? this._name.toLowerCase().replace(' ', '')
    this._displayName = config?.displayname ?? config?.displayName ?? config.display_name ?? this._name
    this._url = config?.url ?? `@${this._username}`
    // this._url = this.#fixUsernameUrl(this._url)
    this._avatar = config?.avatar ?? config?._avatar ?? '/i/accounts/avatars/missing.png'
    // this._avatar = this.#fixAvatarUrl(this._avatar)
    this._header = config?.header ?? config?._header ?? '/i/accounts/headers/generic.png'
    // this._header = this.#fixHeaderUrl(this._header)
    this._keys = config?.keys ?? { signing: [], encrypting: [] }
    this._jwts = config?.jwts ?? null
    this._created_on = config?.createdOn ?? config?.created_on ?? Date.now()
    this._updated_on = config?.updatedOn ?? config?.updated_on ?? null
    this._description = config?.description ?? 'This is a user.'
    this._userStatus = config?.status ?? config?.userStatus ?? 'inactive'
    this._publicDir = config?.publicDir ?? null
    this._privateDir = config?.privateDir ?? null
    this._sessionId = config?.sessionId ?? null
    this._schemaVer = config?.schemaVer
    // Mastodon specific required fields
    this._isLocked = config?.locked ?? config?.isLocked ?? true
    this._isBot = config?.bot ?? false
    this._isDiscoverable = config?.discoverable ?? true
    this._isGroup = config?.group ?? false
    this._fields = config?.fields ?? []
    this._emojis = config?.emojis ?? []
    this._followers_count = config?.followers_count ?? 0
    this._following_count = config?.following_count ?? 0
    // Is this user account archived?
    this._archived = config?.archived ?? false
  }

  /**
   *
   */
  #fixHeaderUrl(url) {
    let goodUrl = url
    // const { protocol, host } = this._ctx
    const { origin } = this._ctx.request
    const pattern = new RegExp(`${origin}/i/a/avatars/.*$`)
    if (!pattern.test(url)) {
      goodUrl = url.replace(/^(http|https):\/\/(<<app.host>>)\/(.*)$/, (m, p, h, x) => `${origin}/${x}`)
    }
    return goodUrl
  }

  /**
   *
   */
  #fixAvatarUrl(url) {
    let goodUrl = url
    const { protocol, host } = this._ctx
    const pattern = new RegExp(`${host}/i/accounts/avatars/.*$`)
    if (!pattern.test(url)) {
      goodUrl = url.replace(/^(http|https):\/\/(<<app.host>>)\/(.*)$/, (m, p, h, x) => `${protocol}://${host}/${x}`)
    }
    return goodUrl
  }

  /**
   *
   */
  #fixUsernameUrl(url) {
    let goodUrl = url
    const { protocol, host } = this._ctx
    const pattern = new RegExp(`${host}/@(.*){2,30}$`)
    if (!pattern.test(url)) {
      goodUrl = url.replace(/^(http|https):\/\/(<<app.host>>)\/(.*)/, () => `${protocol}://${host}/@${this._username}`)
    }
    return goodUrl
  }

  /**
   * Static property used to compare with instanceof expressions.
   * @static
   * @typeOfUser { string }
   */
  static typeOfUser = 'User'

  /**
   * A static class method to check if a given user object is a User.
   * @static
   * @param { object } obj - Object to check instanceof against.
   * @return { boolean } - True if object checked is instance of User class.
   */
  static [Symbol.hasInstance](obj) {
    if (obj.typeOfUser === this.typeOfUser) return true
    return false
  }

  /**
   * Static class method to compare a given password with a user's stored password.
   * Passwords are Bcrypt hashed and salted before they are saved in the database.
   * Bcrypt compare is used to compare.
   * @static
   * @async
   * @param { string } email - Email address used to find existing user in the database.
   * @param { string } password - Cleartext password provided for comparison with hash.
   * @throws { Error }
   * @return { boolean } - True/False result of comparison.
   */
  static async cmpPassword(email, password) {
    let userToComparePassword
    // const filter = { email }
    const filter = { email, archived: false }
    const options = { projection: { hashedPassword: 1 } }
    let result
    try {
      await client.connect()
      const db = client.db(this.dbDatabase)
      const users = db.collection(this.dbCollection)
      userToComparePassword = await users.findOne(filter, options)
      if (userToComparePassword != null) {
        // Boolean value returned from bcrypt.compare function.
        result = await bcrypt.compare(password, userToComparePassword.hashedPassword)
      }
    } catch (err) {
      error('Exception during cmpPasssword')
      throw new Error(err.message)
    } finally {
      await client.close()
    }
    // True if password == hashedPassword, and False if !=.
    return result
  }

  /**
   * Simple class method wrapper around fs/promises.mkdir function.
   * @summary Simple class method wrapper around fs/promises.mkdir function.
   * @async
   * @param { string } directory - Path of directory to be created.
   * @throws { Error } If directory argument is missing or already exists.
   * @return { undefined }
   */
  /* eslint-disable-next-line class-methods-use-this */
  async makedir(directory) {
    try {
      await mkdir(directory, { recursive: true })
      return true
    } catch (e) {
      error(`Failed to mkdir ${directory}`)
      throw e
    }
  }

  /**
   * Check to see if the keys directories are present in public and private user dirs.
   * @summary Check to see if the keys directories are present in public and private user dirs.
   * @async
   * @throws { Error } If keys dirs cannot be created.
   * @return { boolean } Returns true if keys dirs exist or are successfully created.
   */
  async #keyDirs() {
    const pubKeyDir = path.resolve(this._ctx.app.dirs.public.dir, `${this.publicDir}/keys`)
    const priKeyDir = path.resolve(this._ctx.app.dirs.private.dir, `${this.privateDir}/keys`)
    try {
      try {
        if ((await stat(pubKeyDir)).isDirectory()) {
          log('keys public directory exists')
        } else {
          error('not a directory')
        }
      } catch (e) {
        error('no such directory')
        await this.makedir(pubKeyDir)
      }
      try {
        if ((await stat(priKeyDir)).isDirectory()) {
          log('keys private directory exists')
        } else {
          error('not a directory')
        }
      } catch (e) {
        error('no such directory')
        await this.makedir(priKeyDir)
      }
    } catch (e) {
      error(`Failed to create keys directories for user ${this.username}`)
      throw new Error(e)
    }
    return true
  }

  /**
   * Private class method to generate Webcrypto Subtle signing key pair.
   * @summary Private class method to generate Webcrypto Subtle signing key pair.
   * @async
   * @private
   * @param { Object } o - Webcrypto Subtle key generation options.
   * @param { string } o.name - Key type name.
   * @param { number } o.modulusLength - The length in bits of the RSA modulus.
   * @param { Array } o.publicExponent - The RSA public exponent, as an Uint8Array.
   * @param { string } o.hash - The name of the hash function used.
   * @param { boolean } o.extractable - Is this key extractable?
   * @param { string[] } o.uses - What the key is used for.
   * @return { Object } An object literal with status and generated keys.
   */
  async #generateSigningKeys(o = {}) {
    const keyOpts = { ...o }
    const keyIndex = o?.keyIndex ?? this._keys.signing.length
    let keyExists
    const pubKeyPath = path.resolve(this._ctx.app.dirs.public.dir, `${this.publicDir}/keys/rs256-public-${keyIndex}.pem`)
    const jwkeyPath = path.resolve(this._ctx.app.dirs.public.dir, `${this.publicDir}/keys/rs256-${keyIndex}.jwk`)
    const priKeyPath = path.resolve(this._ctx.app.dirs.private.dir, `${this.privateDir}/keys/rs256-private-${keyIndex}.pem`)
    try {
      await this.#keyDirs()
    } catch (e) {
      error(e)
      throw new Error(e)
    }
    try {
      keyExists = await stat(pubKeyPath)
      if (keyExists.isFile()) {
        // Check if keys already exists.  If so, no-op.
        return { status: null }
      }
    } catch (e) {
      error(`fs.stat(${pubKeyPath}) failed.  Keys not created yet.`)
      keyExists = false
    }
    log(`Creating ${this.username}'s RS256 keypair.`)
    const keys = await subtle.generateKey(
      {
        name: keyOpts.name,
        modulusLength: keyOpts.modulusLength,
        publicExponent: keyOpts.publicExponent,
        hash: keyOpts.hash,
      },
      keyOpts.extractable,
      keyOpts.uses,
    )
    let pub
    let jwk
    let pri
    const kid = ulid()
    try {
      jwk = await subtle.exportKey('jwk', keys.publicKey)
      jwk.kid = kid
      jwk.use = 'sig'
      keys.jwk = jwk
      pub = await subtle.exportKey('spki', keys.publicKey)
      pri = await subtle.exportKey('pkcs8', keys.privateKey)
    } catch (e) {
      error('Failed to export newly generated keypair.')
      error(e)
      return { status: null }
    }
    let pubToPem = Buffer.from(String.fromCharCode(...new Uint8Array(pub)), 'binary').toString('base64')
    pubToPem = pubToPem.match(/.{1,64}/g).join('\n')
    pubToPem = '-----BEGIN PUBLIC KEY-----\n'
      + `${pubToPem}\n`
      + '-----END PUBLIC KEY-----'
    let priToPem = Buffer.from(String.fromCharCode(...new Uint8Array(pri)), 'binary').toString('base64')
    priToPem = priToPem.match(/.{1,64}/g).join('\n')
    priToPem = '-----BEGIN PRIVATE KEY-----\n'
      + `${priToPem}\n`
      + '-----END PRIVATE KEY-----'
    try {
      log(`Saving ${pubKeyPath}`)
      await writeFile(pubKeyPath, pubToPem)
      log(`Saving ${jwkeyPath}`)
      await writeFile(jwkeyPath, JSON.stringify(jwk))
      log(`Saving ${pubKeyPath}`)
      await writeFile(priKeyPath, priToPem)
    } catch (e) {
      error(`Failed to save newly generated keypair to ${this.username}'s account.`)
      error(e)
      return { status: null }
    }
    const result = {
      name: keyOpts.name,
      hash: keyOpts.hash,
      bits: keyOpts.modulusLength,
      kid,
      publicKey: pubKeyPath,
      privateKey: priKeyPath,
      jwk: jwkeyPath,
    }
    this._keys.signing.unshift(result)
    result.status = 'success'
    return result
  }

  /**
   * Private class method to generate Webcrypto Subtle encrypting key pair.
   * @summary Private class method to generate Webcrypto Subtle encrypting key pair.
   * @async
   * @private
   * @param { object } o - Webcrypto Subtle key generation options.
   * @param { string } o.name - Key type name.
   * @param { number } o.modulusLength - The length in bits of the RSA modulus.
   * @param { Array } o.publicExponent - The RSA public exponent, as an Uint8Array.
   * @param { string } o.hash - The name of the hash function used.
   * @param { boolean } o.extractable - Is this key extractable?
   * @param { string[] } o.uses - What the key is used for.
   * @return { object } An object literal with status and generated keys.
   */
  async #generateEncryptingKeys(o = {}) {
    const keyOpts = o
    const keyIndex = o?.keyIndex ?? this._keys.encrypting.length
    let keyExists
    const pubKeyPath = path.resolve(this._ctx.app.dirs.public.dir, `${this.publicDir}/keys/rsa-oaep-public-${keyIndex}.pem`)
    const jwkeyPath = path.resolve(this._ctx.app.dirs.public.dir, `${this.publicDir}/keys/rsa-oaep-${keyIndex}.jwk`)
    const priKeyPath = path.resolve(this._ctx.app.dirs.private.dir, `${this.privateDir}/keys/rsa-oaep-private-${keyIndex}.pem`)
    try {
      await this.#keyDirs()
    } catch (e) {
      error(e)
      throw new Error(e)
    }
    try {
      keyExists = await stat(pubKeyPath)
      if (keyExists.isFile()) {
        // Check if keys already exists.  If so, no-op.
        return { status: null }
      }
    } catch (e) {
      error(`fs.stat(${pubKeyPath}) failed.  RSA-OAEP encrypting keypair not created yet.`)
      keyExists = false
    }
    log(`Creating ${this.username}'s RSA-OAEP keypair.`)
    const keys = await subtle.generateKey(
      {
        name: keyOpts.name,
        modulusLength: keyOpts.modulusLength,
        publicExponent: keyOpts.publicExponent,
        hash: keyOpts.hash,
      },
      keyOpts.extractable,
      keyOpts.uses,
    )
    let pub
    let jwk
    let pri
    const kid = ulid()
    try {
      jwk = await subtle.exportKey('jwk', keys.publicKey)
      jwk.kid = kid
      jwk.use = 'enc'
      keys.jwk = jwk
      pub = await subtle.exportKey('spki', keys.publicKey)
      pri = await subtle.exportKey('pkcs8', keys.privateKey)
    } catch (e) {
      error('Failed to export newly generated AES-OAEP keypair.')
      error(e)
      return { status: null }
    }
    let pubToPem = Buffer.from(String.fromCharCode(...new Uint8Array(pub)), 'binary').toString('base64')
    pubToPem = pubToPem.match(/.{1,64}/g).join('\n')
    pubToPem = '-----BEGIN PUBLIC KEY-----\n'
      + `${pubToPem}\n`
      + '-----END PUBLIC KEY-----'
    let priToPem = Buffer.from(String.fromCharCode(...new Uint8Array(pri)), 'binary').toString('base64')
    priToPem = priToPem.match(/.{1,64}/g).join('\n')
    priToPem = '-----BEGIN PRIVATE KEY-----\n'
      + `${priToPem}\n`
      + '-----END PRIVATE KEY-----'
    try {
      log(`Saving ${pubKeyPath}`)
      await writeFile(pubKeyPath, pubToPem)
      log(`Saving ${jwkeyPath}`)
      await writeFile(jwkeyPath, JSON.stringify(jwk))
      log(`Saving ${pubKeyPath}`)
      await writeFile(priKeyPath, priToPem)
    } catch (e) {
      error(`Failed to save newly generated AES-OAEP keypair to ${this.username}'s account.`)
      error(e)
      return { status: null }
    }
    const result = {
      name: keyOpts.name,
      hash: keyOpts.hash,
      bits: keyOpts.modulusLength,
      kid,
      publicKey: pubKeyPath,
      privateKey: priKeyPath,
      jwk: jwkeyPath,
    }
    this._keys.encrypting.unshift(result)
    result.status = 'success'
    return result
  }

  /**
   * Create public/private encryption keys.
   * @summary Create public/private encryption keys.
   * @see https://www.nearform.com/blog/implementing-the-web-cryptography-api-for-node-js-core/
   * @async
   * @param { object } both - Object containing boolean for creating both types of keys.
   * @param { boolean } both.signing - Should generate signing keys.
   * @param { boolean } both.encrypting - Should generate encrypting keys.
   * @param { object } sign - Webcrypto Subtle signing key generation options.
   * @param { object } enc - Webcrypto Subtle encrypting key generation options.
   * @return { object } An object literal with success or error status.
   */
  async generateKeys(both = { signing: true, encrypting: true }, sign = {}, enc = {}) {
    if (this._archived) {
      // no-op
      return { status: null }
    }
    const signingKeyOpts = {
      name: process.env.RSA_SIG_KEY_NAME ?? 'RSASSA-PKCS1-v1_5',
      modulusLength: parseInt(process.env.RSA_SIG_KEY_MOD, 10) ?? 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: process.env.RSA_SIG_KEY_HASH ?? 'SHA-256',
      extractable: (process.env.RSA_SIG_KEY_EXTRACTABLE.toLowerCase() === 'true') ?? true,
      uses: ['sign', 'verify'],
      ...sign,
    }
    const encryptingKeyOpts = {
      name: process.env.RSA_ENC_KEY_NAME ?? 'RSA-OAEP',
      modulusLength: parseInt(process.env.RSA_ENC_KEY_MOD, 10) ?? 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: process.env.RSA_ENC_KEY_TYPE ?? 'SHA-256',
      extractable: (process.env.RSA_ENC_KEY_EXTRACTABLE.toLowerCase() === 'true') ?? true,
      uses: ['encrypt', 'decrypt'],
      ...enc,
    }
    const result = {}
    if (both.signing) {
      let signingKeys
      try {
        signingKeys = await this.#generateSigningKeys(signingKeyOpts)
        // this._keys.signing = signingKeys
        // this._keys.signing.unshift(signingKeys)
        // delete this._keys.signing.status
        result.signing = signingKeys
      } catch (e) {
        error('Failed to generate Webcrypto.subtle signing keys.')
        error(e)
        return { result: 'failed' }
      }
    }
    if (both.encrypting) {
      let encryptingKeys
      try {
        encryptingKeys = await this.#generateEncryptingKeys(encryptingKeyOpts)
        // this._keys.encrypting = encryptingKeys
        // this._keys.encrypting.unshift(encryptingKeys)
        // delete this._keys.encrypting.status
        result.encrypting = encryptingKeys
      } catch (e) {
        error('Failed to generate Webcrypto.subtle encrypting keys.')
        error(e)
        return { result: 'failed' }
      }
    }
    result.status = 'success'
    return result
  }

  /**
   * Import the RSASSA-PKCS1-v1_5 private signing key.
   * @summary Import the RSASSA-PKCS1-v1_5 private signing key.
   * @async
   * @private
   * @param { number } keyIndex - The index of the signing keys array.
   * @return { CryptoKey } An imported RSA private crypto key.
   */
  async #importSigningPrivateKey(keyIndex = 0) {
    // const pemfile = await readFile(this._keys.signing.privateKey)
    const pemfile = await readFile(this._keys.signing[keyIndex].privateKey)
    const b64lines = pemfile.toString()
      .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '')
      .replace(/\s/g, '')
    const bytestring = atob(b64lines)
    const bytearray = new Uint8Array(bytestring.length)
    for (let i = 0; i < bytestring.length; i += 1) {
      bytearray[i] = bytestring.charCodeAt(i)
    }
    const privateKey = await subtle.importKey(
      'pkcs8',
      bytearray,
      // { name: this._keys.signing.name, hash: this._keys.signing.hash },
      { name: this._keys.signing[keyIndex].name, hash: this._keys.signing[keyIndex].hash },
      true,
      ['sign'],
    )
    return privateKey
  }

  /**
   * Import the RSASSA-PKCS1-v1_5 public signing key.
   * @summary Import the RSASSA-PKCS1-v1_5 public signing key.
   * @async
   * @private
   * @param { number } keyIndex - The index of the encrypting keys array.
   * @return { CryptoKey } An imported RSA public signing key.
   */
  async #importSigningPublicKey(keyIndex = 0) {
    // const pemfile = await readFile(this._keys.signing.publicKey)
    const pemfile = await readFile(this._keys.signing[keyIndex].publicKey)
    const b64lines = pemfile.toString()
      .replace(/-----(BEGIN|END) PUBLIC KEY-----/g, '')
      .replace(/\s/g, '')
    const bytestring = atob(b64lines)
    const bytearray = new Uint8Array(bytestring.length)
    for (let i = 0; i < bytestring.length; i += 1) {
      bytearray[i] = bytestring.charCodeAt(i)
    }
    const publicKey = await subtle.importKey(
      'spki',
      bytearray,
      // { name: this._keys.signing.name, hash: this._keys.signing.hash },
      { name: this._keys.signing[keyIndex].name, hash: this._keys.signing[keyIndex].hash },
      true,
      ['verify'],
    )
    return publicKey
  }

  /**
   * Import the RSASSA-PKCS1-v1_5 JWK signing key.
   * @summary Import the RSASSA-PKCS1-v1_5 JWK signing key.
   * @async
   * @private
   * @param { number } keyIndex - The index of the signing keys array.
   * @return { CryptoKey } An imported RSA JWK signing key.
   */
  async #importSigningJwk(keyIndex = 0) {
    // const jwkfile = await readFile(this._keys.signing.jwk)
    const jwkfile = await readFile(this._keys.signing[keyIndex].jwk)
    const jwk = JSON.parse(jwkfile.toString())
    // jwk.kid = this._keys.signing.kid
    jwk.kid = this._keys.signing[keyIndex].kid
    return jwk
  }

  /**
   * Import the RSA-OAEP public encrypting key.
   * @summary Import the RSA-OAEP public encrypting key.
   * @async
   * @private
   * @param { number } keyIndex - The index of the encrypting keys array.
   * @return { CryptoKey } An imported RSA public encrypting key.
   */
  async #importEncryptingPublicKey(keyIndex = 0) {
    // const pemfile = await readFile(this._keys.encrypting.publicKey)
    const pemfile = await readFile(this._keys.encrypting[keyIndex].publicKey)
    const b64lines = pemfile.toString()
      .replace(/-----(BEGIN|END) PUBLIC KEY-----/g, '')
      .replace(/\s/g, '')
    const bytestring = atob(b64lines)
    const bytearray = new Uint8Array(bytestring.length)
    for (let i = 0; i < bytestring.length; i += 1) {
      bytearray[i] = bytestring.charCodeAt(i)
    }
    const publicKey = await subtle.importKey(
      'spki',
      bytearray,
      // { name: this._keys.encrypting.name, hash: this._keys.encrypting.hash },
      { name: this._keys.encrypting[keyIndex].name, hash: this._keys.encrypting[keyIndex].hash },
      true,
      ['encrypt'],
    )
    return publicKey
  }

  /**
   * Import the RSA-OAEP private encrypting key.
   * @summary Import the RSA-OAEP private encrypting key.
   * @async
   * @private
   * @param { number } keyIndex - The index of the encrypting keys array.
   * @return { CryptoKey } An imported RSA private encrypting key.
   */
  async #importEncryptingPrivateKey(keyIndex = 0) {
    // const pemfile = await readFile(this._keys.encrypting.privateKey)
    const pemfile = await readFile(this._keys.encrypting[keyIndex].privateKey)
    const b64lines = pemfile.toString()
      .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '')
      .replace(/\s/g, '')
    const bytestring = atob(b64lines)
    const bytearray = new Uint8Array(bytestring.length)
    for (let i = 0; i < bytestring.length; i += 1) {
      bytearray[i] = bytestring.charCodeAt(i)
    }
    const privateKey = await subtle.importKey(
      'pkcs8',
      bytearray,
      // { name: this._keys.encrypting.name, hash: this._keys.encrypting.hash },
      { name: this._keys.encrypting[keyIndex].name, hash: this._keys.encrypting[keyIndex].hash },
      true,
      ['decrypt'],
    )
    return privateKey
  }

  /**
   * Get JWK by key ID.
   * @summary Get JWK by key ID.
   * @async
   * @param { string } kid - The kid property of a JWK to find and return.
   * @return { KeyObject|Boolean } The JWK that matches the kid parameter or false.
   */
  async findKeyById(kid) {
    if (!kid) {
      return false
    }
    const database = this.dbClient.db(this.dbDatabase)
    const users = database.collection(this.dbCollection)
    const sig = { _id: this.objectId(this._id), 'keys.signing': { $elemMatch: { kid } } }
    const enc = { _id: this.objectId(this._id), 'keys.encrypting': { $elemMatch: { kid } } }
    // log(sig)
    // log(enc)
    const key = {}
    let index
    try {
      key.sig = await users.findOne(sig, { projection: { _id: 0, 'keys.signing.$': 1 } })
      // log(key.sig)
      if (key.sig !== null) {
        index = /\/.*(\d)\.jwk$/.exec(key.sig.keys.signing[0].jwk).groups
        return this.#pks('signing', 'jwk', false, index)
      }
      if (key.enc !== null) {
        key.enc = await users.findOne(enc, { projection: { _id: 0, 'keys.encrypting.$': 1 } })
        index = /\/.*(\d)\.jwk$/.exec(key.enc.keys.encrypting[0].jwk).groups
        return this.#pks('encrypting', 'jwk', false, index)
      }
    } catch (e) {
      error(e)
    }
    return false
  }

  /**
   * Use RSA public signing key to verify signature.
   * @summary Use RSA public signing key to verify signature.
   * @async
   * @param { ArrayBuffer } signature - Array buffer containing the signature to verify.
   * @param { ArrayBuffer } data - Array buffer containg the data whose signature is to be verified.
   * @param { number } keyIndex - The index of the signing keys array.
   * @return { boolean } True if the signature is valid, False otherwise.
   */
  async verify(signature, data, keyIndex = 0) {
    if (!data || !signature) {
      return false
    }
    const result = subtle.verify(
      // this._keys.signing.name,
      this._keys.signing[keyIndex].name,
      await this.#importSigningPublicKey(keyIndex),
      signature,
      data,
    )
    return result
  }

  /** Use RSA private signing key to sign data.
   * @summary Use RSA private signing key to sign data.
   * @async
   * @param { string } data - String data to be signed.
   * @param { number } keyIndex - The index of the signing key array.
   * @return { ArrayBuffer } Array buffer containing signed data.
   */
  async sign(data, keyIndex = 0) {
    if (!data) {
      return null
    }
    const dataToSign = new TextEncoder().encode(data)
    const signature = await subtle.sign(
      // this._keys.signing.name,
      this._keys.signing[keyIndex].name,
      await this.#importSigningPrivateKey(keyIndex),
      dataToSign,
    )
    return signature
  }

  /**
   * Use RSA public encryption key to encrypt data.
   * @summary Use RSA public encryption key to encrypt data.
   * @async
   * @param { ArrayBuffer } data - Array buffer of data to be encrypted.
   * @param { string } output - String value specifying output as either 'raw' or 'base64'.
   * @param { number } keyIndex - The index of the encrypting keys array.
   * @return { ArrayBuffer } Array buffer containing encrypted data, if successful.
   */
  async encrypt(data, output = 'raw', keyIndex = 0) {
    if (!data) {
      return null
    }
    const dataToEncrypt = new TextEncoder().encode(data)
    let cipherText = await subtle.encrypt(
      // { name: this._keys.encrypting.name },
      { name: this._keys.encrypting[keyIndex].name },
      await this.#importEncryptingPublicKey(keyIndex),
      dataToEncrypt,
    )
    if (output === 'base64') {
      cipherText = Buffer.from(String.fromCharCode(...new Uint8Array(cipherText)), 'binary').toString('base64')
    }
    return cipherText
  }

  /**
   * Use RSA private encryption key to decrypt data.
   * @summary Use RSA private encryption key to decrypt data.
   * @async
   * @param { ArrayBuffer } data - Array buffer of data to be decrypted.
   * @param { string } format - String specifying input format of cipher text, either 'base64' or 'buffer'.
   * @param { number } keyIndex - The index of the encrypting keys array.
   * @return { string } String containing decrypted data, if successful.
   */
  async decrypt(data, format = 'buffer', keyIndex = 0) {
    if (!data) {
      return null
    }
    let cipherText = data
    if (format === 'base64') {
      cipherText = new Uint8Array(Buffer.from(data, 'base64'))
    }
    const plainText = await subtle.decrypt(
      // { name: this._keys.encrypting.name },
      { name: this._keys.encrypting[keyIndex].name },
      await this.#importEncryptingPrivateKey(keyIndex),
      cipherText,
    )
    return new TextDecoder().decode(plainText)
  }

  /**
   * Generate a signed JWT with user accounts private RSASSA-PKCS1-v1_5 signing key.
   * @summary Generate a signed JWT with user accounts private RSASSA-PKCS1-v1_5 signing key.
   * @async
   * @param { number } keyIndex - The index of the signing key array.
   * @return { string } - A baseUrlEncoded string representing the signed JWT.
   */
  async signJWT(keyIndex = 0) {
    // save this kid value somewhere...
    let thumbprint
    const { origin } = this._ctx.request
    const claims = {
      email: this.emails[0].primary,
    }
    const headers = {
      alg: 'RS256',
      typ: 'jwt',
      // kid: this._keys.signing.kid,
      kid: this._keys.signing[keyIndex].kid,
      jku: `${origin}/@${this.username}/jwks.json`,
      // jku: `${origin}/@${this.username}/jwks-${keyIndex}.json`,
    }
    try {
      thumbprint = await this.jwt.calculateJwkThumbprint(await this.#importSigningJwk(keyIndex), 'sha256')
      headers.x5t = thumbprint
    } catch (e) {
      // error(`Failed to create thumbprint of JWK: ${this._keys.signing.key}`)
      error(`Failed to create thumbprint of JWK: ${this._keys.signing[keyIndex].key}`)
      error(e)
    }
    const jwt = new this.jwt.SignJWT(claims)
      .setProtectedHeader(headers)
      .setIssuedAt()
      .setIssuer(origin)
      .setAudience(origin)
      .setExpirationTime('2h')
      .setSubject(this.username)
      .setJti('unique-identifier-1234-5678-9001')
      .sign(await this.#importSigningPrivateKey(keyIndex))
    return jwt
  }

  /**
   * Verifies the payload format and the included JWS signature.
   * @summary Verifies the payload format and the included JWS signature.
   * @async
   * @param { string } token - A signed JWT to decode.
   * @param { number } keyIndex - The index of the signing keys array.
   * @return { JWTVerifyResult } An object literal containing decoded payload and any protected headers.
   */
  async verifyJWT(token, keyIndex = 0) {
    let result
    let jwk
    try {
      jwk = await this.jwt.importJWK(await this.#importSigningJwk(keyIndex), 'RS256')
    } catch (e) {
      // error(`Failed to import ${this.username}'s JWK: ${this._keys.signing.jwk}`)
      error(`Failed to import ${this.username}'s JWK: ${this._keys.signing[keyIndex].jwk}`)
      error(e)
      return false
    }
    try {
      result = await this.jwt.jwtVerify(token, jwk)
    } catch (e) {
      error(`Failed to verify token: ${token}`)
      error(e)
      return false
    }
    return result
  }

  /**
   * Simple class method wrapper around fs/promises.rename function.
   * @summary Simple class method wrapper around fs/promises.rename function.
   * @param { string } directory - Path of directory to be renamed.
   * @throws { Error } If directory argument is missing or doesn't already exists.
   * @return { undefined }
   */
  /* eslint-disable-next-line class-methods-use-this */
  renamedir(newName) {
    const oldName = `${this._ctx.app.publicDir}/${this._publicDir}`
    log(`Renaming ${oldName} to ${newName}`)
    try {
      rename(oldName, newName, (err) => {
        if (err) {
          error('fs:rename sync error: %o', err)
          throw err
        }
      })
      return true
    } catch (e) {
      error(`Failed to rename ${oldName} to ${newName}`)
      throw e
    }
  }

  /**
   * Class method to update user's password.
   * @summary Class method to update user's password.
   * @async
   * @param { string } currentPassword - User's current password, to test is correct.
   * @param { string } newPassword - New string value to be hashed and saved.
   * @throws { Error }
   * @return { Object } - Object literal with success message.
   */
  async updatePassword(currentPassword = null, newPassword = null) {
    const result = {
      message: null,
      success: null,
      error: [],
      // originalHash: this.password,
    }
    if (!currentPassword) {
      result.error.push('Missing required current password parameter.')
      result.success = false
    }
    if (!newPassword) {
      result.error.push('Missing required new password parameter.')
      result.success = false
    }
    if (result.error.length > 0) {
      result.error = result.error.join('\n')
      result.success = false
      return result
    }
    if (await bcrypt.compare(currentPassword, this._hashedPassword)) {
      // currentPassword is a match, hash new password
      this.password = newPassword
      result.error = null
      result.message = 'Password has been updated'
      result.success = true
      // result.newHash = this.password
    } else {
      result.error = 'Current password was not a valid match.'
      result.success = false
    }
    return result
  }

  /**
   * Static class method to find user in the database, searching by email address.
   * @static
   * @async
   * @param { string } email - Email address to search by in the database.
   * @param { Mongodbclient } _db - Connection to db if needed.
   * @param { Object } o - Additional optional filtering values.
   * @param { boolean } o.archived - Is the user account archived.
   * @return { Promise(<User>|null) } - Instance of User with properties populated.
   */
  static async findByEmail(email, _db, o) {
    let foundUserByEmail
    // const filter = { email }
    const filter = { 'emails.primary': email, archived: o.archived }
    try {
      await client.connect()
      // const db = client.db(DATABASE)
      const db = client.db()
      const users = db.collection(COLLECTION)
      foundUserByEmail = await users.findOne(filter)
    } catch (err) {
      error('Exception during findByEmail')
      throw new Error(err.message)
    } finally {
      await client.close()
    }
    // If no user found by email, returned result is NULL.
    if (foundUserByEmail != null) {
      return foundUserByEmail
      // return new User({
      //   id: foundUserByEmail._id,
      //   type: foundUserByEmail.type,
      //   first_name: foundUserByEmail.first,
      //   last_name: foundUserByEmail.last,
      //   name: foundUserByEmail.name,
      //   username: foundUserByEmail.username,
      //   displayName: foundUserByEmail?.displayName,
      //   url: foundUserByEmail?.url,
      //   avatar: foundUserByEmail?.avatar,
      //   header: foundUserByEmail?.header,
      //   email: foundUserByEmail.email,
      //   emails: foundUserByEmail?.emails,
      //   hashedPassword: foundUserByEmail.hashedPassword,
      //   jwts: foundUserByEmail.jwts,
      //   keys: foundUserByEmail.keys,
      //   created_on: foundUserByEmail.createdOn,
      //   updated_on: foundUserByEmail.updatedOn,
      //   description: foundUserByEmail.description,
      //   sessionId: foundUserByEmail?.sessionId,
      //   schemaVer: foundUserByEmail?.schemaVer,
      //   archived: foundUserByEmail?.archived,
      // })
    }
    return foundUserByEmail
  }

  /**
   * Static class method to find user in the database, searching by ObjectId value.
   * @static
   * @async
   * @param {string} id - ObjectId value to search by in the database.
   * @param { Mongodbclient } _db - Connection to db if needed.
   * @param { Object } o - Additional optional filtering values.
   * @param { boolean } o.archived - Is the user account archived.
   * @return { Promise(<User>|null) } - Instance of User with properties populated.
   */
  static async findById(id, _db, o = {}) {
    let foundUserById
    const opts = { archived: false, ...o }
    try {
      await client.connect()
      // const db = client.db(DATABASE)
      const db = client.db()
      const users = db.collection(COLLECTION)
      foundUserById = await users.findOne({ _id: ObjectId(id), archived: opts.archived })
    } catch (err) {
      error(`Exception during findById(${id})`)
      error(err.message)
      throw new Error(err)
    } finally {
      // await client.close()
    }
    // If no user found by ObjectId(_id), returned result is NULL.
    if (foundUserById != null) {
      return foundUserById
      // return new User({
      //   id: foundUserById._id.toString(),
      //   type: foundUserById.type,
      //   first_name: foundUserById.first,
      //   last_name: foundUserById.last,
      //   name: foundUserById.name,
      //   username: foundUserById.username,
      //   displayName: foundUserById?.displayName,
      //   url: foundUserById?.url,
      //   avatar: foundUserById?.avatar,
      //   header: foundUserById?.header,
      //   email: foundUserById.email,
      //   emails: foundUserById?.emails,
      //   hashedPassword: foundUserById.hashedPassword,
      //   jwts: foundUserById.jwts,
      //   keys: foundUserById.keys,
      //   created_on: foundUserById.createdOn,
      //   updated_on: foundUserById.updatedOn,
      //   description: foundUserById.description,
      //   sessionId: foundUserByEmail?.sessionId,
      //   schemaVer: foundUserByEmail?.schemaVer,
      //   archived: foundUserByEmail?.archived,
      // })
    }
    return foundUserById
  }

  /**
   * @static
   * @async
   * @param { string } username - Find the single user with the username parameter.
   * @param { object } o - Additional optional filtering values.
   * @param { boolean } o.archived - Is the user account archived.
   * @return { Promise(<User>|null } - Instance of a User with the properties populated.
   */
  static async findByUsername(username, o) {
    let foundUserByUsername
    try {
      await client.connect()
      // const db = client.db(DATABASE)
      const db = client.db()
      const users = db.collection(COLLECTION)
      foundUserByUsername = await users.findOne({ username, archived: o.archived })
    } catch (err) {
      error('Exception during findByUsername')
      throw new Error(err.message)
    } finally {
      await client.close()
    }
    if (foundUserByUsername !== null) {
      return foundUserByUsername
      // return new User({
      //   id: foundUserByUsername._id,
      //   type: foundUserByUsername.type,
      //   first_name: foundUserByUsername.first,
      //   last_name: foundUserByUsername.last,
      //   name: foundUserByUsername.name,
      //   email: foundUserByUsername.email,
      //   emails: foundUserByUsername?.emails,
      //   username: foundUserByUsername?.username,
      //   displayName: foundUserByUsername?.displayName,
      //   url: foundUserByUsername?.url,
      //   avatar: foundUserByUsername?.avatar,
      //   header: foundUserByUsername?.header,
      //   hashedPassword: foundUserByUsername.hashedPassword,
      //   jwts: foundUserByUsername.jwts,
      //   keys: foundUserByUsername.keys,
      //   created_on: foundUserByUsername.createdOn,
      //   updated_on: foundUserByUsername.updatedOn,
      //   desciption: foundUserByUsername.description,
      //   sessionId: foundUserByEmail?.sessionId,
      //   schemaVer: foundUserByEmail?.schemaVer,
      //   archived: foundUserByEmail?.archived,
      // })
    }
    return foundUserByUsername
  }

  /**
   * Static class method to find user in the database, searching by sessionId value.
   * @static
   * @async
   * @param { string } sessId - Current session ID of user as stored by redis.
   * @param { object } o - Additional optional filtering values.
   * @param { boolean } o.archived - Is the user account archived.
   * @return { Promise(<User>|null } - Instance of a User with properties populated.
   */
  static async findBySessionId(sessId, o) {
    let foundUserBySessionId
    try {
      await client.connect()
      // const db = client.db(DATABASE)
      const db = client.db()
      const users = db.collection(COLLECTION)
      foundUserBySessionId = await users.findOne({ sessionId: sessId, archived: o.archived })
    } catch (err) {
      error('Exception during findBySessionId')
      throw new Error(err.message)
    } finally {
      await client.close()
    }
    if (foundUserBySessionId != null) {
      return foundUserBySessionId
      // return new User({
      //   id: foundUserBySessionId._id,
      //   type: foundUserBySessionId.type,
      //   first_name: foundUserBySessionId.first,
      //   last_name: foundUserBySessionId.last,
      //   name: foundUserBySessionId.name,
      //   email: foundUserBySessionId.email,
      //   emails: foundUserBySessionId?.emails,
      //   username: foundUserBySessionId?.username,
      //   displayName: foundUserBySessionId?.displayName,
      //   url: foundUserBySessionId?.url,
      //   avatar: foundUserBySessionId?.avatar,
      //   header: foundUserBySessionId?.header,
      //   hashedPassword: foundUserBySessionId.hashedPassword,
      //   jwts: foundUserBySessionId.jwts,
      //   keys: foundUserBySessionId.keys,
      //   created_on: foundUserBySessionId.createdOn,
      //   updated_on: foundUserBySessionId.updatedOn,
      //   description: foundUserBySessionId.description,
      //   sessionId: foundUserByEmail?.sessionId,
      //   schemaVer: foundUserByEmail?.schemaVer,
      //   archived: foundUserByEmail?.archived,
      // })
    }
    return foundUserBySessionId
  }

  /**
   * Stringifies the instance properties of the user, excluding and DB stuff.
   * @summary Stringifies the instance properties of the user, excluding and DB stuff.
   * @return { string } - A stringified version of a JSON literal of user properties.
   */
  toString() {
    return JSON.stringify({
      id: this._id,
      type: this._type,
      status: this._userStatus,
      first_name: this._first,
      last_name: this._last,
      full_name: this._name,
      emails: this._emails,
      username: this._username,
      displayName: this._displayName,
      url: this._url,
      avatar: this._avatar,
      header: this._header,
      // password: this._hashedPassword,
      jwts: this._jwts,
      created_on: this._created_on,
      updated_on: this._updated_on,
      description: this._description,
      sessionId: this._sessionId,
      schemaVer: this._schemaVer,
      archived: this._archived,
    }, null, 2)
  }

  /**
   * Stringifies the instance properties of the user, excluding and DB stuff.
   * @summary Stringifies the instance properties of the user, excluding and DB stuff.
   * @return { string } - A stringified version of a JSON literal of user properties.
   */
  serialize() {
    const propertiesToSerialize = ['_type', '_userStatus', '_first', '_last', '_name', '_emails', '_username', '_displayName', '_url', '_avatar', '_header', '_hashedPassword', '_created_on', '_updated_on', '_description', '_jwts', '_sessionId', '_schemaVer', '_archived']
    const that = this
    log(that._jwts)
    return JSON.stringify(that, propertiesToSerialize)
  }

  /**
   * Returns an array of the minimum required properties to instantiate a new user.
   */
  requiredProperties() {
    // this._requiredProperties = ['_first', '_last', '_email', '_emails', '_hashedPassword', '_jwts', '_type', '_userStatus']
    this._requiredProperties = ['_first', '_last', '_emails', '_hashedPassword', '_jwts', '_type', '_userStatus']
    return this._requiredProperties
  }

  /**
   * Sanity check to ensure all required properties have a value before saving the user.
   * @throws { Error }
   * @return { boolean } - True or throws Error if missing any required properties.
   */
  checkRequired() {
    const missing = []
    const props = this.requiredProperties()
    props.forEach((key) => {
      if (!this[key] || this[key] === null || this[key] === 'undefined' || this[key] === '') {
        missing.push(key)
      }
    })
    if (missing.length > 0) {
      const msg = missing.map((item) => item.slice(1)).join(', ')
      const eMsg = `Missing the follwing required properties: ${msg}`
      throw new Error(eMsg)
    }
    return true
  }

  /**
   * Sanity check to ensure a valid database client connection object is present before
   * issuing any database queries.
   * @throws { Error }
   * @return { boolean } - True or throws Error is client connection is not working.
   */
  checkDB() {
    const _log = log.extend('checkDB')
    const _err = error.extend('checkDB')
    const missing = []
    if (!this.dbClient || this.dbClient === null || this.dbClient === 'undefined') {
      missing.push('DB client connection object')
    }
    if (!this.dbDatabase || this.dbDatabase === null || this.dbDatabase === 'undefined') {
      missing.push('Database name')
    }
    if (!this.dbCollection || this.dbCollection === null || this.dbCollection === 'undefined') {
      missing.push('Collection name')
    }
    if (missing.length > 0) {
      const msg = missing.join(', ')
      _err(msg)
      throw new Error(`Missing the following required database properties: ${msg}`)
    }
    // log(this.dbDatabse)
    // log(this.dbCollection)
    // log(this.dbClient)
    _log(typeof this.dbClient)
    // _log(this.dbClient.prototype.toString())
    _log(Object.getPrototypeOf(this.dbClient))
    return true
  }

  /**
   * Performs an update on an existing user.  All user instance properties are sent
   * back to the database during the update.  Update query requires the user to have
   * a valid ObjectId value.
   * @async
   * @throws { Error }
   * @return { Promise<UpdateResult> } - MongoDB UpdateResult object or throws an Error.
   */
  async update() {
    // Check required properties are all non-null values.
    // Throw an exception error back to the caller if not.
    log('1: Calling checkRequired()')
    this.checkRequired()
    // Check database client connection is available.
    // Throw an exception error back to the caller if not.
    this.checkDB()
    log('2: Calling checkDB()')
    let result
    try {
      let users
      if (this.dbClient.connect) {
        await this.dbClient.connect()
        log('3: Calling dbClient.connect()')
        const database = this.dbClient.db(this.dbDatabase)
        users = database.collection(this.dbCollection)
      } else {
        users = this.dbClient
      }
      log(`4: Setting update filter doc with ${this._id}`)
      const filter = { _id: this.objectId(this._id) }
      const update = {
        $set: {
          type: this._type,
          first: this._first,
          last: this._last,
          emails: this._emails,
          username: this._username,
          displayName: this._displayName,
          url: this._url,
          avatar: this._avatar,
          header: this._header,
          publicDir: this._publicDir,
          privateDir: this._privateDir,
          hashedPassword: this._hashedPassword,
          jwts: this._jwts,
          keys: this._keys,
          updatedOn: Date.now(),
          description: this._description,
          userStatus: this._userStatus,
          sessionId: this._sessionId,
          schemaVer: this._schemaVer,
          archived: this._archived,
          // Mastodon fields
          locked: this._isLocked,
          bot: this._isBot,
          discoverable: this._isDiscoverable,
          group: this._isGroup,
          emojis: this._emojis,
          fields: this._fields,
          followers_count: this._followers_count,
          following_count: this._following_count,
        },
      }
      const options = { writeConcern: { w: 'majority' }, upsert: false, returnDocument: 'after', projection: { _id: 1, email: 1, first: 1 } }
      log('5: Calling findOneAndUpdate.')
      result = await users.findOneAndUpdate(filter, update, options)
      log(result)
    } catch (err) {
      if (err) {
        error('6: catch err', err)
        throw new Error('Update failed!', { cause: err })
      }
    } finally {
      // await this.dbClient.close()
    }
    log('7: returning result')
    // return result
    return this
  }

  /**
   * Performs an insert of a new user.  All user instance properties are sent
   * to the database during the insert.  Insert query requires the user to have
   * a unique email address.
   * @async
   * @throws { Error }
   * @return { Promise<User> } - A populated user instance or throws an Error.
   */
  async save() {
    // Check required properties are all non-null values.
    // Throw an exception error back to the caller if not.
    log('1: Calling checkRequired()')
    this.checkRequired()
    // Check database client connection is available.
    // Throw an exception error back to the caller if not.
    this.checkDB()
    log('2: Calling checkDB()')
    let result
    try {
      let users
      if (this.dbClient.connect) {
        await this.dbClient.connect()
        log('3: Calling dbClient.connect()')
        const database = this.dbClient.db(this.dbDatabase)
        users = database.collection(this.dbCollection)
      } else {
        users = this.dbClient
      }
      this._updated_on = Date.now()
      // Inserting a new user.
      log('5: This is a new user - insertOne.')
      const insert = {
        type: this._type,
        first: this._first,
        last: this._last,
        emails: this._emails,
        username: this._username,
        displayName: this._displayName,
        url: this._url,
        avatar: this._avatar,
        header: this._header,
        publicDir: this._publicDir,
        privateDir: this._privateDir,
        hashedPassword: this._hashedPassword,
        jwts: this._jwts,
        keys: this._keys,
        updatedOn: this._updated_on,
        createdOn: this._created_on,
        description: this._description,
        userStatus: this._userStatus,
        sessionId: this._sessionId,
        archived: this._archived,
        schemaVer: this._schemaVer,
        // Mastodon fields
        locked: this._isLocked,
        bot: this._isBot,
        discoverable: this._isDiscoverable,
        group: this._isGroup,
        emojis: this._emojis,
        fields: this._fields,
        followers_count: this._followers_count,
        following_count: this._following_count,
      }
      const options = { writeConcern: { w: 'majority' } }
      log('6: Calling insertOne.')
      result = await users.insertOne(insert, options)
      log('7: typeof result = ', typeof result)
      if (result?.insertedId != null) {
        // Get the newly creted ObjectId and assign it to this._id.
        // log('ObjectId: ', result.insertedId.toString())
        this._id = result.insertedId.toString()
      }
    } catch (err) {
      if (err) {
        error('8: catch err', err)
      }
    } finally {
      // await this.dbClient.close()
    }
    log('9: returning the newly created ObjectId value')
    return this
  }

  /**
   * Id property setter.
   * @param { string } id - A value to be used as a valid ObjectId.
   */
  set id(id) {
    this._id = id
  }

  /**
   * Id proptery getter.
   * @return { string } - Current value to be used as a valid ObjectId.
   */
  get id() {
    return this._id
  }

  /**
   * Archived property setter.
   * @param { boolean } isArchived - A boolean value for whether account is archived or not.
   */
  set archived(isArchived) {
    this._archived = isArchived
  }

  /**
   * Archived property getter.
   * @return { boolean } - Current boolean value of user account archive status.
   */
  get archived() {
    return this._archived
  }

  /**
   * SCHEMA_VERSION currently used to define class properties.
   * @return { number }
   */
  get schemaVersion() {
    return this._schemaVer
  }

  /**
   * Password proptery setter.
   * @param { string } password - Value to be Bcyrpt hashed and salted.
   */
  set password(password) {
    // Have to, for now, rely on synchronous hash method
    // because it is awkward to use async/await promise here.
    let hashOrPassword
    if (/^\$2b\$10/.test(password)) {
      hashOrPassword = password
    } else if (password != null && password !== '') {
      hashOrPassword = bcrypt.hashSync(password, 10)
    }
    this._hashedPassword = hashOrPassword
  }

  /**
   * Password property getter.
   * @return { string } - Bcrypt hashed and salted password value.
   */
  get password() {
    return this._hashedPassword
  }

  /**
   * First name propety setter.
   * @param { string } first - User first name value.
   */
  set firstName(first) {
    this._first = first
    if (!this._name || this._name === null || this._name === 'undefined') {
      if (this._last != null && this._last !== 'undefined') {
        this._name = `${this._first} ${this._last}`
      }
    }
  }

  /**
   * First name property getter.
   * @return { string } - User first name value.
   */
  get firstName() {
    return this._first
  }

  /**
   * Last name propety setter.
   * @param { string } last - User last name value.
   */
  set lastName(last) {
    this._last = last
    if (!this._name || this._name === null || this._name === 'undefined') {
      if (this._first != null && this._first !== 'undefined') {
        this._name = `${this._first} ${this._last}`
      }
    }
  }

  /**
   * Last name property getter.
   * @return { string } - User last name value.
   */
  get lastName() {
    return this._last
  }

  /**
   * Alias for primary email address property setter.
   * @alias primaryEmail
   * @param { string } - User email address value.
   */
  set email(email) {
    this.primaryEmail = email
  }

  /**
   * Alias primary email address property getter.
   * @return { string } - User email address value.
   */
  get email() {
    return this._emails[0]
  }

  /**
   * Primary email address property setter.
   * @param { string } - User email address value.
   */
  set primaryEmail(email) {
    // this._email = email
    const re = new RegExp(`^${this._emails[1].secondary}$`)
    if (this._emails.length > 1 && re.test(email)) {
      error('Primary email must be different from the secondary email address.')
      throw new Error('Primary email must be different from the secondary email address.')
    } else {
      this._emails[0] = { primary: email, verified: false }
    }
  }

  /**
   * Primary email address property getter.
   * @return { string } - User email address value.
   */
  get primaryEmail() {
    return this._emails[0]
  }

  /**
   * Seconday email address property setter.
   * @param { string } - User email address value.
   */
  set secondaryEmail(email) {
    // this._email = email
    const n = this._emails.length
    const re = new RegExp(`^${this._emails[0].primary}$`)
    if (n === 0) {
      error('Missing required primary email address.')
      throw new Error('Missing required primary email address.')
    } else if (re.test(email)) {
      error('Secondary email must be different from the primary email address.')
      throw new Error('Secondary email must be different from the primary email address.')
    } else if (n === 1) {
      this._emails.push({ secondary: email, verified: false })
    } else {
      this._emails[1] = { secondary: email, verified: false }
    }
  }

  /**
   * Secondary email address property getter.
   * @return { string } - User email address value.
   */
  get secondaryEmail() {
    return this._emails[1]
  }

  /**
   * Array of at most two email addresses getter.
   * @return { string[] } - List of email addresses.
   */
  get emails() {
    return this._emails
  }

  /**
   * Array of at most two email addresses setter.
   * @param { string[] } - List of email addresses.
   */
  set emails(emails) {
    // this._emails = emails
    this.primaryEmail({ primary: emails[0], verified: false })
    this.secondaryEmail({ secondary: emails[1], verified: false })
  }

  /**
   * Username property setter.
   * @param { string } - New username value.
   */
  set username(username) {
    this.log('This is a bad design pattern.')
    this.log('Only set username this way if this.isUsernameAvailable() has already been called,')
    this.log('and has returned TRUE.')
    this._username = username
    this.log(`Side affect - update this.url to reflect new username ${username}`)
    this._url = `@${username}`
  }

  /**
   * Username property getter.
   * @return { string } - Username value.
   */
  get username() {
    return this._username
  }

  /**
   * Acct property setter (Mastodaon / Webfinger compatability).
   * @alias username
   * @param { string } - New acct value.
   */
  set acct(username) {
    // this._username = username
    this.log('noop - don\'t update acct / username values.')
  }

  /**
   * Acct property getter (Mastodaon / Webfinger compatability).
   * @alias username
   * @return { string } - Acct value.
   */
  get acct() {
    return this._username
  }

  /**
   * Url property setter (Mastodon compatability).
   * @param { string } - New url value.
   */
  set url(url) {
    let u = url
    if (url[0] !== '@') {
      u = `@${url}`
    }
    if (this._username === url) {
      this.log('noop')
    } else {
      this.log(`noop: trying to set this.url to ${u}`)
    }
  }

  /**
   * Url property getter (Mastodon compatability).
   * @return { string } - Url value.
   */
  get url() {
    return this._url
  }

  /**
   * Avatar url property setter (Mastodon compatability).
   * @param { string } url - New avatar url value.
   */
  set avatar(url) {
    this._avatar = url
  }

  /**
   * Avatar url property getter (Mastodon compatability).
   * @return { string } - Avatar url value.
   */
  get avatar() {
    return this._avatar
  }

  /**
   * Header image url property setter (Mastodon compatability).
   * @param { string } url - Header image url value.
   */
  set header(url) {
    this._header = url
  }

  /**
   * Header image url property getter (Mastodon compatability).
   * @return { string } - Header image url value.
   */
  get header() {
    return this._header
  }

  /**
   * Header image url property setter (Mastodon compatability).
   * @alias header
   * @param { string } url - Header image url value.
   */
  set headerStatic(url) {
    this._header = url
  }

  /**
   * Header image url property getter (Mastodon compatability).
   * @alias header
   * @return { string } - Header image url value.
   */
  get headerStatic() {
    return this._header
  }

  /**
   * Display name property setter.
   * @param { string } newDisplayName - User display name property value.
   */
  set displayName(newDisplayName) {
    this._displayName = newDisplayName
  }

  /**
   * Display name property getter.
   * @return { string } - User display name value.
   */
  get displayName() {
    if (!this._displayName || this._displayName === '' || this._displayName === 'undefined') {
      return `${this._first} ${this._last}`
    }
    return this._displayName
  }

  /**
   * Mastodon compatible display name getter.
   * @alias displayName()
   * @return { string } - User display name.
   */
  get display_name() {
    return this.displayName
  }

  /**
   * Mastodon compatible display name setter.
   * @alias displayName()
   * @param { string } newDisplayName - User display name proptery value.
   * @return { undefined }
   */
  set display_name(newDisplayName) {
    this.displayName = newDisplayName
  }

  /**
   * Full name property setter.
   * @param { string } newName - User full name property value.
   */
  set name(newName) {
    this._name = newName
  }

  /**
   * Full name property getter.
   * @return { string } - User full name value.
   */
  get name() {
    if (!this._name || this._name === '' || this._name === 'undefined') {
      return `${this._first} ${this._last}`
    }
    return this._name
  }

  /**
   * JWT object property setter.
   * @param { Object } tokens - Object literal containing JWTokens.
   * @param { string } tokens.token - Serialized string format of access JWT.
   * @param { string } tokens.refresh - Serialized string format of a refresh JWT.
   */
  set jwts(tokens) {
    this._jwts = tokens
  }

  /**
   * JTW object property getter.
   * @return { Object } - User JWT object literal.
   */
  get jwts() {
    return this._jwts
  }

  /**
   * JWKS.json
   * @summary JWKS.json
   * @async
   * @param { number|string } keyIndex - The index of the key arrays, or 'all'.
   * @return { Object } Object literal with signing JWK and encrypting JWK.
   */
  async jwksjson(keyIndex = 0) {
    // need to update to iterate of each keys array
    // this._keys.signing[]
    // this._keys.encrypting[]
    if (keyIndex === 'all') {
      // return all versions of the jwkeys
      return { keys: 'Not functional yet.' }
    }
    const jwks = { keys: [] }
    const sig = JSON.parse(await this.#pks('signing', 'jwk', false, keyIndex))
    if (sig !== null) {
      jwks.keys.push(sig)
    }
    const enc = JSON.parse(await this.#pks('encrypting', 'jwk', false, keyIndex))
    if (enc !== null) {
      jwks.keys.push(enc)
    }
    return jwks
  }

  /**
   * Public signing keys getter.
   * @summary Public signing keys getter.
   * @async
   * @param { number|string } keyIndex - The index of the key arrays or 'all'.
   * @param { boolean|string } pretty - Whether to pretty print or not, especially for JWks.'
   * @return { Object }
   */
  async publicKeys(keyIndex = 0, pretty = false) {
    if (keyIndex === 'all') {
      // return all the versions of the jwkeys
      return { keys: 'Not functional yet.' }
    }
    const pp = (pretty === 'jwk')
    return {
      signing: {
        pem: await this.#pks('signing', 'publicKey', false, keyIndex),
        jwk: await this.#pks('signing', 'jwk', pp, keyIndex),
      },
      encrypting: {
        pem: await this.#pks('encrypting', 'publicKey', false, keyIndex),
        jwk: await this.#pks('encrypting', 'jwk', pp, keyIndex),
      },
    }
  }

  /**
   * Public signing key getter.
   * @return { Object }
   */
  get publicSigningKey() {
    return this.#pks('signing', 'publicKey', false, 0)
  }

  /**
   * Private signing key getter.
   * @return { Object }
   */
  get privateSigningKey() {
    return this.#pks('signing', 'privateKey', false, 0)
  }

  /**
   * Public signing JWK getter.
   * @return { Object }
   */
  get signingJwk() {
    return this.#pks('signing', 'jwk', true, 0)
  }

  /**
   * Public encrypting key getter.
   * @return { Object }
   */
  get publicEncryptingKey() {
    return this.#pks('encrypting', 'publicKey', false, 0)
  }

  /**
   * Private encrypting key getter.
   * @return { Object }
   */
  get privateEncryptingKey() {
    return this.#pks('encrypting', 'privateKey', false, 0)
  }

  /**
   * Public encrypting JWK getter.
   * @return { Object }
   */
  get encryptingJwk() {
    return this.#pks('encrypting', 'jwk', true, 0)
  }

  async #pks(type = 'signing', format = 'publicKey', pretty = true, keyIndex = 0) {
    let key = null
    // const getKey = this._keys[type][format] ?? null
    const getKey = this._keys[type]?.[keyIndex]?.[format] ?? null
    if (getKey !== null) {
      const access = format === 'publicKey' ? 'public' : 'private'
      try {
        log(`Getting ${access} ${type} key ${getKey}`)
        key = await readFile(getKey)
        key = key.toString()
        if (format === 'jwk' && pretty) {
          key = this.#prettyPrintJwk(key)
        }
      } catch (e) {
        error(e)
      }
    }
    return key
  }

  #prettyPrintJwk(jwk) {
    console.log(jwk)
    // const matches = jwk.match(/(?<key_ops>"key_ops":\[.*\]),(?<ext>"ext":(?:true|false)),(?<kty>"kty":"(?:RSA|AES|ECDSA|HMAC)"),(?<n>"n":"(?<n_val>.*)"),(?<e>"e":".*"),(?<alg>"alg":".*"),(?<kid>"kid":".*"),?(?<use>"use":".*")?/)?.groups
    const matches = jwk.match(/"key_ops":(?<key_ops>\[.*\]),"ext":(?<ext>(true|false)),"kty":(?<kty>".*"),"n":(?<n>".*"),"e":(?<e>".*"),"alg":(?<alg>".*"),"kid":(?<kid>".*"),?(?:"use":(?<use>".*"))?/)
    const groups = matches?.groups
    const indent = '  '
    const string = '{\n'
      + `${indent}"key_ops": ${groups?.key_ops},\n`
      // + `${indent}"ext": ${groups?.ext},\n`
      + `${indent}"kty": ${groups?.kty},\n`
      // + `${indent}"n":" ${groups?.n_val.match(/.{1,64}/g).join(`\n${indent}`)}",\n`
      + `${indent}"n": ${groups?.n.match(/.{1,64}/g).join(`\n${indent}`)},\n`
      + `${indent}"e": ${groups?.e},\n`
      + `${indent}"alg": ${groups?.alg}\n`
      + `${indent}"kid": ${groups?.kid},\n`
      + `${indent}"use": ${groups?.use}\n`
      + '}'
    return string
  }

  /**
   * Note property setter (alias to description - Mastodon compatability).
   * @param { string } note - User account note value.
   */
  set note(note) {
    this._description = note
  }

  /**
   * Note property getter(alias to description - Mastodon compatability).
   * @return { string } - User note property value.
   */
  get note() {
    return this._description
  }

  /**
   * Description property setter.
   * @param { string } description - User desciption value.
   */
  set description(description) {
    this._description = description
  }

  /**
   * Description property getter.
   * @return { string } - User description property value.
   */
  get description() {
    return this._description
  }

  /**
   * User type property setter.
   * @param { string } userType - User type property value.
   */
  set type(userType = 'User') {
    if (userType.toLowerCase() === 'admin') {
      this._type = 'Admin'
    } else {
      this._type = 'User'
    }
  }

  /**
   * User type property getter.
   * @return { string } - User type property value.
   */
  get type() {
    return this._type
  }

  /**
   * User status property setter.
   * @param { string } status - A value of either 'active' or 'inactive'.
   */
  set status(status) {
    this._userStatus = status
  }

  /**
   * User status property getter.
   * @return { string } - Current status of user.
   */
  get status() {
    return this._userStatus
  }

  /**
   * Mastodon compatibility - whether account manually approves follow requests.
   * @param { boolean } isLocked - User manually approves follow requests.
   * @return { undefined }
   */
  set locked(isLocked) {
    this._isLocked = isLocked
  }

  /**
   * Mastodon compatibility - does account manually approve follow requests?
   * @return { boolean }
   */
  get locked() {
    return this._isLocked
  }

  /**
   * Mastodon compatibility - Additional metadata attached to a profile as an array of name-value pairs.
   * @param { Object[] } field - name/value object literal (a.k.a field) or an array of name/value fields.
   * @return { undefined }
   */
  set fields(field) {
    if (Array.isArray(field)) {
      this._fields = field
    } else {
      this._fields.push(field)
    }
  }

  /**
   * Mastodon compatibility - Additional metadata fields attached to a profile.
   * @return { Object[] } - name/value object literal.
   */
  get fields() {
    return this._fields
  }

  /**
   * Mastodon compatibility - whether account is a bot or not.
   * @param { boolean } isBot - User account is a bot or not.
   * @return { undefined }
   */
  set bot(isBot) {
    this._isBot = isBot
  }

  /**
   * Mastodon compatibility - Is account a bot or not?
   * @return { boolean }
   */
  get bot() {
    return this._isBot
  }

  /**
   * Mastodon compatibility - whether account is a discoverable or not.
   * @param { boolean } isDiscoverable - User account is a discoverable or not.
   * @return { undefined }
   */
  set discoverable(isDiscoverable) {
    this._isDiscoverable = isDiscoverable
  }

  /**
   * Mastodon compatibility - Is account discoverable or not?
   * @return { boolean }
   */
  get discoverable() {
    return this._isDiscoverable
  }

  /**
   * Mastodon compatibility - Custom emoji entities to be used when rendering the profile.
   * @param { string[] } emojis - Custom emoji entities to be used when rendering the profile.
   * @return { undefined }
   */
  set emojis(emojis) {
    if (Array.isArray(emojis)) {
      this._emojis.concat(emojis)
    } else {
      this._emojis = emojis
    }
  }

  /**
   * Mastodon compatibility - Custom emoji entities to be used when rendering the profile.
   * @return { string[] }
   */
  get emojis() {
    return this._emojis
  }

  /**
   * Mastodon compatibility - whether account is a group actor or not.
   * @param { boolean } isGroup - User account is a group actor or not.
   * @return { undefined }
   */
  set group(isGroup) {
    this._isGroup = isGroup
  }

  /**
   * Mastodon compatibility - Is account is a group actor or not?
   * @return { boolean }
   */
  get group() {
    return this._isGroup
  }

  /**
   * Mastodon compatibility - The reported followers of this profile.
   * @param { number } followersCount - The reported followers of this profile.
   * @return { undefined }
   */
  set followers_count(followersCount) {
    this._followers_count = followersCount
  }

  /**
   * Mastodon compatibility - The reported followers of this profile?
   * @return { number }
   */
  get followers_count() {
    return this._followers_count
  }

  /**
   * Mastodon compatibility - The reported follows of this profile.
   * @param { number } followingCount - The reported follows of this profile.
   * @return { undefined }
   */
  set following_count(followingCount) {
    this._following_count = followingCount
  }

  /**
   * Mastodon compatibility - The reported followers of this profile?
   * @return { number }
   */
  get following_count() {
    return this._following_count
  }

  /**
   * User session ID property getter.
   * @return { string } - Current session ID of user.
   */
  get sessionId() {
    return this._sessionId
  }

  /**
   * User session ID property setter.
   * @param { string } sessionId - The current session ID stored in redis.
   */
  set sessionId(sessionId) {
    this._sessionId = sessionId
  }

  /**
   * Database client property setter.
   * @param { MongoClient } db -  User db connection property value.
   */
  set db(db) {
    this.dbClient = db
  }

  /**
   * Database client property getter.
   * @return { MongoClient } - User db connection proertery value.
   */
  get db() {
    return this.dbClient
  }

  /**
   * Check whether a username already exists in the database.
   * @summary Check whether a username already exists in the database.
   * @async
   * @param { string } - username to check in the database.
   * @throws { Error }
   * @return { Boolean } True or False.
   */
  async isUsernameAvailable(check = false) {
    if (!check) {
      error('Missing required username parameter.')
      throw new Error('Missing required username parameter.')
    }
    let isAvailable = false
    let username = check
    if (check[0] === '@') {
      username = check.slice(1)
    }
    try {
      await client.connect()
      const db = client.db(this.dbDatabase)
      const users = db.collection(this.dbCollection)
      const match = { username }
      const options = { projection: { _id: 1 } }
      const found = await users.findOne(match, options)
      log(found)
      if (!found) {
        isAvailable = true
      }
    } catch (e) {
      error(e)
      throw new Error(e)
    }
    return isAvailable
  }

  /**
   * publicDir proptery setter.
   * @param { string } location - Path to set user's publicDir location.
   * @return { undefined }
   */
  set publicDir(location) {
    if (!location) {
      error('Missing required location parameter.')
      throw new Error('Missing required location parameter.')
    }
    if (!this._ctx) {
      error('Missing koa ctx config values.')
      throw new Error('Missing koa ctx config values.')
    }
    let relPublicPath
    let fullPublicPath
    let relPrivatePath
    let fullPrivatePath
    const hashedId = createHash('md5').update(this._id.toString()).digest('hex')
    log(`hashedId ${hashedId}`)
    // Check to see if <location> contains the MD5 hashed user id field as part of path.
    // If not, add it so path looks like /path/to/koa-app-root/public/<location>/<hashedId>/
    const re = new RegExp(`${hashedId}`)
    if (!re.test(location)) {
      relPublicPath = `${location}/${hashedId}/`
      fullPublicPath = `${this._ctx.app.publicDir}/${location}/${hashedId}/`
      relPrivatePath = `${location}/${hashedId}/`
      fullPrivatePath = `${this._ctx.app.dirs.private.dir}/${location}/${hashedId}/`
    } else {
      relPublicPath = `${location}/`
      fullPublicPath = `${this._ctx.app.publicDir}/${location}/`
      relPrivatePath = `${location}/`
      fullPrivatePath = `${this._ctx.app.dirs.private.dir}/${location}/`
    }
    if (this._publicDir === null || this._publicDir === '') {
      // publicDir not set yet, create it now
      log(`Creating a new publicDir for ${this.emails[0].primary} at ${location}`)
      log(`Creating a new privateDir for ${this.emails[0].primary} at ${fullPrivatePath}`)
      log(`ctx.app.root: ${this._ctx.app.root}`)
      try {
        log(`public shortPath: ${relPublicPath}`)
        log(`public fullPath: ${fullPublicPath}`)
        this.makedir(fullPublicPath)
        this._publicDir = relPublicPath
      } catch (e) {
        const msg = `Failed setting ${this.emails[0].primary}'s publicDir ${fullPublicPath}.`
        error(msg)
        throw new Error(msg, { cause: e })
      }
      try {
        log(`private shortPath: ${relPrivatePath}`)
        log(`private fullPath: ${fullPrivatePath}`)
        this.privateDir = relPrivatePath
        // this.makedir(fullPrivatePath)
        // this._privateDir = relPrivatePath
      } catch (e) {
        const msg = `Failed setting ${this.emails[0].primary}'s privateDir ${fullPrivatePath}.`
        error(msg)
        throw new Error(msg, { cause: e })
      }
    } else {
      // renaming old publicDir to new name
      const oldFullPublicPath = `${this._ctx.app.publicDir}/${this.publicDir}`
      const newFullPublicPath = path.resolve(`${this._ctx.app.publicDir}`, `${location}`)
      const newRelPublicPath = `${location}/`
      log(`Renaming ${this.emails[0].primary}'s publicDir from ${oldFullPublicPath} to ${newFullPublicPath}`)
      // resolve the new path to the same root path...
      try {
        if (this.renamedir(newFullPublicPath)) {
          this._publicDir = newRelPublicPath
        }
      } catch (e) {
        const msg = `Failed to rename ${this.emails[0].primary}'s publicDir from ${oldFullPublicPath} to ${newFullPublicPath}`
        error(msg, { cause: e })
        throw new Error(e)
      }
      // renaming old privateDir to new name
      const oldFullPrivatePath = `${this._ctx.app.dirs.private.accounts}/${this._privateDir}`
      const newFullPrivatePath = path.resolve(`${this._ctx.app.dirs.private.accounts}`, `${location}`)
      const newRelPrivatePath = `${location}`
      log(`Renaming ${this.emails[0].primary}'s privateDir from ${oldFullPrivatePath} to ${newFullPrivatePath}`)
      try {
        if (this.renamedir(newFullPrivatePath)) {
          this._privateDir = newRelPrivatePath
        }
      } catch (e) {
        const msg = `Failed to rename ${this.emails[0].primary}'s privateDir from ${oldFullPrivatePath} to ${newFullPrivatePath}`
        error(msg)
        throw new Error(msg, { cause: e })
      }
    }
  }

  /**
   * publicDir property getter.
   * @return { string } - Directory location of user's publicDir.
   */
  get publicDir() {
    return this._publicDir
  }

  /**
   * privateDir property setter.
   * @param { string } location - Path to set user's privateDir location.
   * @return { undefined }
   */
  set privateDir(location) {
    if (location !== '') {
      try {
        this.makedir(`${this._ctx.app.dirs.private.dir}/${location}`)
        this._privateDir = location
      } catch (e) {
        error(`Failed setting ${this.emails[0].primary}'s privateDir`)
        throw new Error(`Failed setting ${this.emails[0].primary}'s privateDir`, { cause: e })
      }
    }
  }

  /**
   * privateDir property getter.
   * @return { string } - Directory location of users's privateDir.
   */
  get privateDir() {
    return this._privateDir
  }
}

export {
  User,
}
