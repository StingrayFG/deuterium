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

const authenticateJWT = (req, res, next) => { // JWT verification middleware
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



// Handle login
router.post('/panel/login', async function(req, res, next) {
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

// Get the server status
router.get('/panel/status', authenticateJWT, async function(req, res, next) {
  const filesSize = await getFolderSize('uploads/') / (1024 * 1024);
  const filesCount = fs.readdirSync('uploads/').length;

  res.setHeader('Content-Type', 'application/json');
  res.send({status: {version: process.env.npm_package_version, 
    uptime: process.uptime().toFixed(0), filesSize: filesSize.toFixed(1), filesCount}});
});



// Find files by the search parameters
router.post('/panel/files/search/parameters', authenticateJWT, async function(req, res, next) {
  var safeDateFrom = new Date(0);
  var safeDateTo = new Date();

  // Parse dates if they are specified in the request body
  if (req.body.searchParams.dateFrom.length > 0) {
    safeDateFrom = new Date(req.body.searchParams.dateFrom).toISOString();
  }
  if (req.body.searchParams.dateTo.length > 0) {
    safeDateTo = new Date(req.body.searchParams.dateTo).toISOString();
  }

  var files = [];
  
  if (req.body.searchParams.ip.length > 0) { // Search with filtering by ip
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
  } else { // Search without filtering by ip
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

// find file by the specified hashsum
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
      uploadDate: file.uploadDate,
      isBlacklisted: file.isBlacklisted
    }]});
  } else {
    res.send({files: []});
  }
});

// download a file ignoring the blacklist
router.get('/panel/files/file/:uuid/download', authenticateJWT, async function(req, res, next) {
  const file = await prisma.file.findUnique({ // Getting the file name from the database to find it on the disk
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


// Delete a file by uuid
router.post('/panel/files/file/:uuid/delete', authenticateJWT, async function(req, res, next) {
  const file = await prisma.file.findUnique({ // Getting the file name from the database to delete it from the disk
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
    await fs.unlinkSync('uploads/' + file.name); // Delete file from the disk
  
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

// Blacklist files by their hashsum
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

// Remove files from blacklist by  their hashsum
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

// Create a new user from the panel
router.post('/panel/users/create', authenticateJWT, async function(req, res, next) {
  var exists = false;
  var user;

  try {
    user = await prisma.user.create({
      data: {
        login: req.body.userData.login,
        password: req.body.userData.password
      },
  })} catch (e) {
    exists = true;
  }

  if (user) {
    res.sendStatus(200);
  } else if (exists) {
    res.sendStatus(400);
  }
});

module.exports = router;
