const express = require("express")
const app = express()
const path = require("path")
const multer = require("multer")
const cloudinary = require('cloudinary').v2
const streamifier = require('streamifier')
const env = require("dotenv")
env.config()
const exphbs = require("express-handlebars");
const clientSessions = require("client-sessions");

app.engine('.hbs', exphbs.engine({ extname: '.hbs',
  helpers: { 
    strong: function(options){
      return '<strong>' + options.fn(this) + '</strong>';
    },
    formatDate: function(dateObj){ 
      let year = dateObj.getFullYear(); 
      let month = (dateObj.getMonth() + 1).toString(); 
      let day = dateObj.getDate().toString(); 
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2,'0')}`; 
  } 
  }
}));
app.set('view engine', '.hbs');

const videoService = require("./videoService")
const authService = require("./authService")

const upload = multer()

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_API_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
})

app.use(express.urlencoded({ extended: true }));

const HTTP_PORT = process.env.PORT || 8080

function onHttpStart() {
  console.log("Express http server listening on: " + HTTP_PORT);
}

app.use(express.static("public"))

app.use(clientSessions({
  cookieName: "session", // req.session
  secret: "week10example_web322",
  duration: 2 * 60 * 1000, // duration of the session in milliseconds (2 minutes)
  activeDuration: 1000 * 60 // the session will be extended by this many ms each request (1 minute)
})) 

function ensureLogin(req, res, next) {
  if (!req.session.user) {
    res.redirect("/login");
  } else {
    next();
  }
}

app.use(function(req, res, next) {
  res.locals.session = req.session;
  next();
});

app.get("/", ensureLogin, (req, res) => {
  videoService.getVideos().then((videos) => {
    res.render('index', {
      data: videos,
      layout: 'main'
    })
  }).catch((err) => {
    console.log(err)
    res.send(err)
  })

  // res.sendFile(path.join(__dirname, "/views/index.html"))
})

app.get("/tags", ensureLogin, (req, res) => {
  videoService.getTags().then((tags) => {
    res.json(tags)
  }).catch((err) => {
    console.log(err)
    res.send(err)
  })
})

app.get("/tags/new", ensureLogin, (req, res) => {

  // var a = [{id:1, tag: "blah"},{id: 2, tag: "blah blah"}]
  videoService.getTags().then((tags) => {
    res.render('newTag', {
      data: tags,
      layout: 'main'
    })
  }).catch((err) => {
    console.log(err)
    res.send(err)
  })

  // res.sendFile(path.join(__dirname,"/views/newTag.html"))
})

app.post("/tags/new", ensureLogin, (req, res) => {
  videoService.addTag(req.body).then(() => {
    res.redirect("/tags/new")
  }).catch((err)=> {
    res.redirect("/tags/new")
  })
})

app.get("/tags/delete/:id", ensureLogin, (req, res) => {
  videoService.deleteTag(req.params.id).then(() => {
    res.redirect("/tags/new")
  }).catch((err) => {
    console.log(err)
    res.send(err)
  })
})

app.get("/videos", ensureLogin, (req, res) => {
  videoService.getVideos().then((videos) => {
    res.json(videos)
  }).catch((err) => {
    console.log(err)
    res.send(err)
  })
})


app.get("/videos/tag/:tag", ensureLogin, (req, res) => {
  videoService.getVideoByTag(req.params.tag).then((videos) => {
    res.render('index', {
      data: videos,
      layout: 'main'
    })
  }).catch((err) => {
    console.log(err)
    res.send(err)
  })
})

app.get("/videos/new", ensureLogin, (req, res) => {

  videoService.getTags().then((tags) => {
    res.render('newBrief', {
      data: tags,
      layout: 'main'
    })
  }).catch((err) => {
    console.log(err)
    res.send(err)
  })
  // res.sendFile(path.join(__dirname, "/views/newBrief.html"))
})

app.post("/videos/new", ensureLogin, upload.single("videoFile"), (req, res) => {
  if (req.file) {
    let streamUpload = (req) => {
      return new Promise((resolve, reject) => {
        let stream = cloudinary.uploader.upload_stream(
          {resource_type: "video"},
          (error, result) => {
            if (result) {
              resolve(result);
            } else {
              reject(error);
            }
          }
        );

        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
    };

    async function upload(req) {
      let result = await streamUpload(req);
      console.log(result);
      return result;
    }

    upload(req).then((uploaded) => {
      processPost(uploaded.url);
    });
  } else {
    processPost("");
  }

  function processPost(videoURL) {
    req.body.videoFile = videoURL;
    videoService.addBrief(req.body).then(() => {
      res.redirect("/")
    }).catch((err) => {
      res.redirect("/videos/new")
    })
  }

})

app.get("/videos/delete/:id", ensureLogin, (req, res) => {
  videoService.deleteVideo(req.params.id).then(() => {
    res.redirect("/")
  }).catch((err) => {
    console.log(err)
    res.send(err)
  })
})

app.get("/videos/likes/:id", ensureLogin, (req, res) => {
  videoService.addLikeByVideo(req.params.id).then(() => {
    res.redirect("/")
  }).catch((err) => {
    console.log(err)
    res.send(err)
  })
})

app.get("/videos/:id", ensureLogin, (req, res) => {
  videoService.getVideoByID(req.params.id).then((video) => {
    res.render('index', {
      data: video,
      layout: 'main'
    })
  }).catch((err) => {
    console.log(err)
    res.send(err)
  })
})

app.get("/register", (req, res) => {
  res.render('register', {
    layout: 'main'
  })
})

app.post("/register", (req, res) => {
  authService.registerUser(req.body).then(() => {
    res.render('register', {
      successMessage: "USER CREATED SUCCESSFULLY!",
      layout: 'main'
    })
  }).catch((err)=> {
    console.log(err)
    res.render('register', {
      errorMessage: err,
      layout: 'main'
    })
  })
})

app.get("/login", (req, res) => {
  res.render('login', {
    layout: 'main'
  })
})

app.post("/login", (req, res) => {
  req.body.userAgent = req.get('User-Agent');
  authService.loginUser(req.body).then((user) => {
    req.session.user = {
      username: user.username,
      email: user.email,
      loginHistory: user.loginHistory
    }

    res.redirect("/")
  }).catch((err)=> {
    console.log(err)
    res.render('login', {
      errorMessage: err,
      layout: 'main'
    })
  })
})

app.get("/loginHistory", ensureLogin, (req,res) => {
  res.render('loginHistory', {
    layout: 'main'
  })
})

app.get("/logout", ensureLogin, (req, res) => {
  req.session.reset();
  res.redirect("/login");
});

app.use((req, res) => {
  res.status(404).send("Page Not Found")
})

videoService.initialize()
.then(authService.initialize)
.then(() => {
  app.listen(HTTP_PORT, onHttpStart)
}).catch((err) => {
  console.log(err)
})