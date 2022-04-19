require('dotenv').config({ path: './tests/.env' })
const { MongoClient, ObjectId } = require('mongodb')

const clientDn = process.env.MONGODB_CLIENT_DN
const dbHost = process.env.MONGODB_HOST
const dbPort = process.env.MONGODB_PORT
const authMechanism = 'MONGODB-X509'
const authSource = '$external'
const clientPEMFile = encodeURIComponent(process.env.MONGODB_CLIENT_KEY)
const dbCAKeyFile = encodeURIComponent(process.env.MONGODB_CAKEYFILE)
const uri = `mongodb://${clientDn}@${dbHost}:${dbPort}/mattmadethese?replicaSet=myReplicaSet&authMechanism=${authMechanism}&tls=true&tlsCertificateKeyFile=${clientPEMFile}&tlsCAFile=${dbCAKeyFile}&authSource=${authSource}`

const client = new MongoClient(uri)

module.exports = {
	client,
	ObjectId
}
