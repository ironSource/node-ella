'use strict';

// Adapted from sindresorhus/package-json

const url = require('url')
    , request = require('request')
    , registryUrl = require('registry-url')
    , rc = require('rc')('npm')

module.exports = function fetchPackage(name, done) {
	const scope = name.split('/')[0]
      , path = encodeURIComponent(name).replace(/^%40/, '@')
	    , pkgUrl = url.resolve(registryUrl(scope), path)
	    , token = getToken(scope)
	    , opts = { json: true, auth: token ? { bearer: token } : null }

  request(pkgUrl, opts, function (err, res, body) {
    if (err) {
      done(err)
    } else if (res.statusCode === 404) {
      done(new Error('Package `' + name + '` doesn\'t exist'))
    } else {
      done(null, body)
    }
  })
}

function getToken(scope) {
  const token = rc[scope + ':_authToken'] || rc['//registry.npmjs.org/:_authToken']

  if (token && process.env.NPM_TOKEN) {
    return token.replace('${NPM_TOKEN}', process.env.NPM_TOKEN)
  } else {
    return token
  }
}
