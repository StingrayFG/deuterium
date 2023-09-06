var path = require('path');
var crypto = require('crypto');

var express = require('express');
var router = express.Router();

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

var multer = require('multer');
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname + '.' + Date.now()) //Appending extension
  }
})

var upload = multer({ storage: storage });

router.get('/', async function(req, res, next) {
  res.send('file');
});

router.post('/', upload.single('file'), async function(req, res, next) {
  var uuid = crypto.randomUUID()
  

  

  res.json({ link: uuid });
  res.send;
});

module.exports = router;
