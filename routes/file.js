var path = require('path');
var fs = require('fs');
var crypto = require('crypto');

var express = require('express');
var router = express.Router();

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

var multer = require('multer');
var storage = multer.diskStorage({ // Multer middleware to handle file upload
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname + '.' + Date.now()) 
  }
})
var upload = multer({ storage: storage });



// Handle file upload
router.post('/upload', upload.single('file'), async function(req, res, next) {
  const fileUuid = Buffer.from(crypto.randomUUID(), 'hex').toString('base64url');

  var hash = crypto.createHash('md5');
  const file = fs.readFileSync('uploads/' + req.file.filename)
  hash.update(file);
  const hashDigest = hash.digest('hex');

  console.log(new Date().toISOString());
  console.log(req.headers);

  const record = await prisma.blacklist.findUnique({ // Check whether the uploaded file is present in blacklist
    where: {
      hashSum: hashDigest
    }
  })

  res.setHeader('Content-Type', 'application/json');
  if (record) { // If it is blacklisted, remove it from the disk
    await fs.unlinkSync('uploads/' + file.name); 

    res.sendStatus(403);
  } else { // If it is not blacklisted, add data about it to the database
    await prisma.file.create({
      data: {
        uuid: fileUuid,
        name: req.file.filename,
        hashSum: hashDigest,
        uploadIP: req.headers['x-forwarded-for']
      },
    })
  
    res.json({ fileUuid: fileUuid });
    res.send;
  }
});

// Get the file data
router.get('/file/:uuid', async function(req, res, next) {
  const file = await prisma.file.findUnique({
    where: {
      uuid: req.params.uuid,
      isBlacklisted: false
    }
  })

  console.log(new Date().toISOString());

  res.setHeader('Content-Type', 'application/json');
  if (file) {
    res.send({  
      fileData: 
        {exists: true,
        name: path.parse(file.name).name, 
        size: (fs.statSync('uploads/' + file.name).size / (1024 * 1024)).toFixed(1), 
        hashSum: file.hashSum}
    });
  } else {
    res.send({fileData: {exists: false}});
  }
});

// Download the file
router.get('/file/:uuid/download', async function(req, res, next) {
  const file = await prisma.file.findUnique({ // Find file's data in the database to locate it on the disk
    where: {
      uuid: req.params.uuid,
      isBlacklisted: false
    }
  })

  console.log(new Date().toISOString());

  if (file) {
    res.set('Content-Disposition', `attachment; filename="${path.parse(file.name).name}"`);
    res.sendFile(file.name, { root: 'uploads/'});
  } else {
    res.status(404).send('Not Found');
  }
});

module.exports = router;
