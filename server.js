const uuid = require('uuid');
const express = require('express')
const app = express();
const fs = require('fs');
const multer = require('multer');
const port = 1337;
const debug = require('debug')('app');
const path = require('path');
const directory = path.join(__dirname, 'uploads');

fs.readdir(directory, (err, files) => {
    if (err) throw err;

    for (const file of files) {
        fs.unlink(path.join(directory, file), err => {
            if (err) throw err;
        });
    }
});
const storage = {
    media: {
        maxSize: 50 * 1024 * 1024, // 50 ла
        allowedTypes: ['image/jpeg', 'image/png', 'video/mp4'],
        maxFiles: 5,
        files: []
    },
    books: {
        maxSize: 10 * 1024 * 1024, // 10 ла
        allowedTypes: ['application/pdf', 'text/plain'],
        maxFiles: 5,
        files: []
    },
    executables: {
        maxSize: 100 * 1024 * 1024, // 100 ла
        allowedTypes: [
            'application/x-msdownload',
            'application/x-sh',
            'application/x-executable'
        ],
        maxFiles: 5,
        files: []
    },
    video: {
        maxSize: 30 * 1024 * 1024, // 30 ла
        allowedTypes: ['video/mp4', 'video/avi', 'video/mpeg'],
        maxFiles: 5,
        files: []
    },
    audio: {
        maxSize: 5 * 1024 * 1024, // 5 ла
        allowedTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg'],
        maxFiles: 5,
        files: []
    },
    docs: {
        maxSize: 50 * 1024 * 1024, // 50 ла
        allowedTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
        maxFiles: 5,
        files: []
    }
};
function getFileByName(name) {
    
    for (const type in storage) {
        const files = storage[type].files;
        for (const file of files) {
            if (file.originalname === name) {
              
                return {
                    name: file.originalname,
                    size: file.size,
                    warhouse: type,
                    type: file.mimetype
                };
            }
        }
    }

    return null;
}   
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});
const uploadFile = (store, req, res) => {
    const uploadStorage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, 'uploads/')
        },
        filename: function (req, file, cb) {
            cb(null, file.originalname)
        }
    });
    const upload = multer({ storage: uploadStorage }).single('file');
    upload(req, res, (err) => {
        if (err) {
            console.log(err);
            return res.status(500).send('File upload error');
        }
        if (store.files.length >= store.maxFiles) {
            fs.unlinkSync(req.file.path);
            return res.status(400).send('Maximum number of files reached');
        }
        if (req.file.size > store.maxSize) {
            fs.unlinkSync(req.file.path);
            return res.status(400).send('File is very big');
        }

        if (!store.allowedTypes.includes(req.file.mimetype))
        {
            fs.unlinkSync(req.file.path);
            return res.status(400).send('This type of files cannot be uploaded');
        }

        store.files.push(req.file);
        res.send('File uploaded suscecfully');
    });
};

const downloadFile = (store, req, res) => {
  const filename = req.params.filename;
  const file = store.files.find((file) => file.filename === filename);

  if (!file) {
    return res.status(404).send('File is not found');
  }

  res.setHeader('Content-Disposition', `attachment; filename="${file.originalname}"`);
  res.setHeader('Content-Type', file.mimetype);

  fs.stat(file.path, (err, stats) => {
    if (err) {
      console.error(err);
      return res.status(500).send('File read error');
    }

    res.setHeader('Content-Length', stats.size);

    fs.createReadStream(file.path, { highWaterMark: 1024 * 1024 })
      .on('error', (err) => {
        console.error(err);
          return res.status(500).send('File read error');
      })
      .pipe(res);
  });
};

app.post('/upload/:store', (req, res) => {
    const storeName = req.params.store;
    const store = storage[storeName];

    if (!store) {
        return res.status(404).send('Storage is not found');
    }

    uploadFile(store, req, res);
});

app.get('/download/:store/:filename', (req, res) => {
    const storeName = req.params.store;
    const store = storage[storeName];

    if (!store) {
        return res.status(404).send('Storage is not found');
    }

    downloadFile(store, req, res);
});

app.get('/storages', (req, res) => {
    const storageTypes = Object.keys(storage);
    const storageInfo = {};

    for (const type of storageTypes) {
        const { maxSize, allowedTypes, maxFiles, files } = storage[type];
        const fileNames = files.length ? files.map((file) => file.originalname) : [''];
        const usedStorage = files.reduce((acc, curr) => acc + curr.size, 0);
        storageInfo[type] = {
            maxSize,
            allowedTypes,
            maxFiles,
            fileCount: files.length,
            usedStorage,
            fileNames,
        };
    }

    res.json(storageInfo);
});
app.get('/info/:fileName', (req, res) => {
    const name = req.params.fileName;
    const file = getFileByName(name);

    if (file) {
        res.json(file);
    } else {
        res.status(404).send('File not found');
    }
});


app.listen(port, () => {
    debug(`Server listening on port ${port}`);
});