var path = require('path');
const fs = require('fs');
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


router.get('/file/:uuid', async function(req, res, next) {
  const file = await prisma.file.findUnique({
    where: {
      uuid: req.params.uuid
    }
  })

  res.setHeader('Content-Type', 'application/json');
  if (file) {
    res.send(JSON.stringify({ exists: true, fileName: path.parse(file.fileName).name, 
    fileSize: (fs.statSync('uploads/' + file.fileName).size / 1000000).toFixed(1)}));
  } else {
    res.send(JSON.stringify({ exists: false }));
  }
});

router.get('/file/:uuid/download', async function(req, res, next) {
  const file = await prisma.file.findUnique({
    where: {
      uuid: req.params.uuid
    }
  })

  if (file) {
    res.set('Content-Disposition', `attachment; filename="${path.parse(file.fileName).name}"`);
    res.sendFile(file.fileName, { root: 'uploads/'});
  } else {
    res.status(404).send('Not Found');
  }
});

router.post('/upload', upload.single('file'), async function(req, res, next) {
  var uuid = Buffer.from(crypto.randomUUID(), 'hex').toString('base64');

  const post = await prisma.file.create({
    data: {
      uuid,
      fileName: res.req.file.filename
    },
  })

  res.json({ uuid: uuid });
  res.send;
});

module.exports = router;
