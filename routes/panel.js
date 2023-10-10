var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var jwt = require('jsonwebtoken');
const util = require("util");
const getFolderSize = util.promisify(require("get-folder-size"));

var express = require('express');
var router = express.Router();

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
      const token = authHeader.split(' ')[1];

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
          if (err) {
              return res.sendStatus(403);
          }

          req.user = user;
          next();
      });
  } else {
      res.sendStatus(401);
  }
};



// handle logins
router.post('/panel/login', async function(req, res, next) {
  console.log(req.body);

  const user = await prisma.user.findUnique({
    where: {
      login: req.body.userData.login,
      password: req.body.userData.password
    }
  })

  res.setHeader('Content-Type', 'application/json');
  if (user) {
    const accessToken = jwt.sign({ username: user.login }, process.env.ACCESS_TOKEN_SECRET);
    res.send({exists: true, accessToken});
  } else {
    res.send({exists: false });
  }
});

// get the server status
router.get('/panel/status', authenticateJWT, async function(req, res, next) {
  const filesSize = await getFolderSize('uploads/') / (1024 * 1024);
  const filesCount = fs.readdirSync('uploads/').length;

  res.setHeader('Content-Type', 'application/json');
  res.send({status: {version: process.env.npm_package_version, 
    uptime: process.uptime().toFixed(0), filesSize: filesSize.toFixed(1), filesCount}});
});



// find files by the search parameters
router.post('/panel/files/search/parameters', authenticateJWT, async function(req, res, next) {
  var safeDateFrom = new Date(0);
  var safeDateTo = new Date();

  if (req.body.searchParams.dateFrom.length > 0) {
    console.log(req.body.searchParams.dateFrom);
    safeDateFrom = new Date(req.body.searchParams.dateFrom).toISOString();
  }
  if (req.body.searchParams.dateTo.length > 0) {
    console.log(req.body.searchParams.dateTo);
    safeDateTo = new Date(req.body.searchParams.dateTo).toISOString();
  }

  var files = [];

  if (req.body.searchParams.ip.length > 0) {
    files = await prisma.file.findMany({
      where: {
        name: {
          contains: req.body.searchParams.name,
          mode: 'insensitive'
        },
        uploadIP: {
          contains: req.body.searchParams.ip,
          mode: 'insensitive'
        },
        uploadDate: {
          gte: safeDateFrom,
          lte: safeDateTo
        }
      },
      take: +req.body.searchParams.maxResults
    })
    console.log(req.body);
  } else {
    files = await prisma.file.findMany({
      where: {
        name: {
          contains: req.body.searchParams.name,
          mode: 'insensitive'
        },
        uploadDate: {
          gte: safeDateFrom,
          lte: safeDateTo
        }
      },
      take: +req.body.searchParams.maxResults
    })
    console.log(req.body);
  }

  files.forEach(file => {
    file.name = path.parse(file.name).name;
  });

  res.setHeader('Content-Type', 'application/json');
  if (files) {
    res.send({files});
  } else {
    res.send({files: []});
  }
});

// find files by hashsum
router.post('/panel/files/search/hash', authenticateJWT, async function(req, res, next) {
  const file = await prisma.file.findFirst({
    where: {
      hashSum: req.body.hashSum
    }
  })

  res.setHeader('Content-Type', 'application/json');
  if (file) {
    res.send({files: [{  
      uuid: file.uuid,
      name: path.parse(file.name).name, 
      hashSum: file.hashSum,
      uploadIP: file.uploadIP,
      uploadDate: file.uploadDate  
    }]});
  } else {
    res.send({files: []});
  }
});

// download the file even if it is blacklisted
router.get('/panel/files/file/:uuid/download', async function(req, res, next) {
  const file = await prisma.file.findUnique({
    where: {
      uuid: req.params.uuid
    }
  })

  if (file) {
    res.set('Content-Disposition', `attachment; filename="${path.parse(file.name).name}"`);
    res.sendFile(file.name, { root: 'uploads/'});
  } else {
    res.status(404).send('Not Found');
  }
});


// delete a file by uuid
router.post('/panel/files/file/:uuid/delete', authenticateJWT, async function(req, res, next) {
  const file = await prisma.file.findUnique({
    where: {
      uuid: req.params.uuid
    }
  })
  
  if (file) {
    await prisma.file.delete({
      where: {
        uuid: file.uuid
      }
    })
    await fs.unlinkSync('uploads/' + file.name);
  
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

// blacklist a file by uuid
router.post('/panel/files/blacklist/:hashsum/add', authenticateJWT, async function(req, res, next) {
  const file = await prisma.file.updateMany({
    where: {
      hashSum: req.params.hashsum
    },
    data: {
      isBlacklisted: true
    }
  })

  record = await prisma.blacklist.create({
    data: {
      hashSum: req.params.hashsum,
      description: req.params.description
    }
  })
  
  if (record) {
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

// blacklist a file by uuid
router.post('/panel/files/blacklist/:hashsum/remove', authenticateJWT, async function(req, res, next) {
  const file = await prisma.file.updateMany({
    where: {
      hashSum: req.params.hashsum
    },
    data: {
      isBlacklisted: false
    }
  })

  record = await prisma.blacklist.delete({
    where: {
      hashSum: req.params.hashsum
    }
  })
  
  if (record) {
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});



module.exports = router;
