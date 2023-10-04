var path = require('path');
var fs = require('fs');
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
    cb(null, file.originalname + '.' + Date.now()) 
  }
})
var upload = multer({ storage: storage });


router.post('/upload', upload.single('file'), async function(req, res, next) {
  var fileUuid = Buffer.from(crypto.randomUUID(), 'hex').toString('base64url');

  var hash = crypto.createHash('md5');
  var file = fs.readFileSync('uploads/' + req.file.filename)
  hash.update(file);
  var hashDigest = hash.digest('hex');
  
  console.log(req.headers);

  await prisma.file.create({
    data: {
      uuid: fileUuid,
      fileName: req.file.filename,
      hashSum: hashDigest,
      uploadIP: req.headers['x-forwarded-for']
    },
  })

  res.json({ fileUuid: fileUuid });
  res.send;
});

router.get('/file/:uuid', async function(req, res, next) {
  const file = await prisma.file.findUnique({
    where: {
      uuid: req.params.uuid
    }
  })

  res.setHeader('Content-Type', 'application/json');
  if (file) {
    res.send({  
      fileData: 
        {exists: true,
        name: path.parse(file.fileName).name, 
        size: (fs.statSync('uploads/' + file.fileName).size / (1024 * 1024)).toFixed(1), 
        hashSum: file.hashSum}
    });
  } else {
    res.send({fileData: {exists: false}});
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

module.exports = router;
