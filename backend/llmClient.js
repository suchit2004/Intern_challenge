const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

function base64url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

module.exports = {};