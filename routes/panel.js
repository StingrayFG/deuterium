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


router.post('/panel/login', async function(req, res, next) {
  console.log(req.body);

  const user = await prisma.panelUser.findUnique({
    where: {
      login: req.body.userData.login,
      password: req.body.userData.password
    }
  })

  res.setHeader('Content-Type', 'application/json');
  if (user) {
    var accessToken = jwt.sign({ username: user.login }, process.env.ACCESS_TOKEN_SECRET);
    res.send({exists: true, accessToken});
  } else {
    res.send({exists: false });
  }
});

router.get('/panel/status', authenticateJWT, async function(req, res, next) {
  var filesSize = await getFolderSize('uploads/') / (1024 * 1024);
  var filesCount = fs.readdirSync('uploads/').length;

  res.send({status: {version: process.env.npm_package_version, 
    uptime: process.uptime().toFixed(0), filesSize: filesSize.toFixed(1), filesCount}});
});


router.get('/panel/files', authenticateJWT, async function(req, res, next) {
  const files = await prisma.file.findMany();

  files.forEach(file => {
    file.name = path.parse(file.name).name;
  });
  if (files) {
    res.send({files});
  } else {
    res.send({files: []});
  }

});

router.post('/panel/files/search', authenticateJWT, async function(req, res, next) {
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
  if (files) {
    res.send({files});
  } else {
    res.send({files: []});
  }
});

router.post('/panel/files/hash', authenticateJWT, async function(req, res, next) {
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

router.post('/panel/files/:uuid/delete', authenticateJWT, async function(req, res, next) {
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


module.exports = router;
