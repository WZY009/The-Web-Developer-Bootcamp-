const express = require('express')
const path = require('path')
const mongoose = require('mongoose')
const Campground = require('./models/campground')
const methodOverride = require('method-override')
const ejsMate = require('ejs-mate')
const catchAsync = require('./utils/catchAsync')
const ExpressError = require('./utils/ExpressError')
const Joi = require('joi')
const {campgroundSchema, reviewSchema} = require('./schemas.js')
const { join } = require('path')
const Review = require('./models/review')
const { validate } = require('./models/campground')
mongoose.connect('mongodb://localhost:27017/yelp-camp') 

const app = express();


const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"))
db.once("open", ()=>{
    console.log("Database connected")
})

app.engine('ejs', ejsMate) 
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.use(express.urlencoded({extended:true}))
app.use(methodOverride('_method'))

const validateCampground = (req, res, next) =>{ 
    const {error} = campgroundSchema.validate(req.body)
    if(error) {
        const msg = error.details.map(el=>el.message).join(',')
        throw new ExpressError(msg, 400)
    } else {
        next()
    }
}
const validateReview = (req, res, next) => {
    const {error} = reviewSchema.validate(req.body)
    if(error) {
        const msg = error.details.map(el=>el.message).join(',')
        throw new ExpressError(msg, 400)
    } else {
        next()
    }
}

app.get('/', (req, res)=>{
    res.render('home')
})
app.get('/campgrounds', catchAsync(async (req, res)=>{
    const campgrounds = await Campground.find({})
    res.render('campgrounds/index',{campgrounds})
}))
app.get('/campgrounds/new', (req, res)=>{
    res.render('campgrounds/new')
}) 
// pay attention！ the order is crucial because if this get is behind '/campgrounds/:id', new will be identified as id
app.post('/campgrounds', validateCampground, catchAsync(async (req, res, next)=>{
    //if(!req.body.campground) throw new ExpressError('Invalid Campground Data', 400)

    /*have a validation on the server side - I create a middleware to reduce duplication or you can build validation on your own.
    const campgroundSchema = Joi.object({
        campground:Joi.object({
            title: Joi.string().required(),
            price: Joi.number().required().min(0),
            image: Joi.string(). required(),
            location: Joi.string().required(),
            description: Joi.string().required()
        }).required()
    })
    const {error} = campgroundSchema.validate(req.body)
    if(error) {
        const msg = error.details.map(el=>el.message).join(',')
        throw new ExpressError(msg, 400)
    }*/

    const newCampground = new Campground(req.body.campground)
    await newCampground.save()
    res.redirect(`/campgrounds/${newCampground._id}`)        

}))
/*
// This post equals to the previous one
app.post('/campgrounds', async(req, res, next)=>{
    try{
        const newCampground = new Campground(req.body.campground)
        await newCampground.save()
        res.redirect(`/campgrounds/${newCampground._id}`) 
    }
    catch(e) {
        next(e)
    }
})
*/

app.get('/campgrounds/:id/edit', catchAsync(async(req, res) => {
    const campground = await Campground.findById(req.params.id)
    res.render('campgrounds/edit', { campground })
}))

app.put('/campgrounds/:id', validateCampground, catchAsync(async(req, res)=>{
    const {id} = req.params
    const campground = await Campground.findByIdAndUpdate(id, {...req.body.campground})
    res.redirect(`/campgrounds/${campground._id}`)
}))

app.delete('/campgrounds/:id', catchAsync(async(req, res)=>{
    const {id} = req.params
    await Campground.findByIdAndDelete(id)
    res.redirect('/campgrounds')
    
    // remove the related reviews when you remove the campground
}))

app.post('/campgrounds/:id/reviews', validateReview, catchAsync(async (req, res) => {
    // res.send('Good')
    const campground = await Campground.findById(req.params.id)
    const review = new Review(req.body.review)
    campground.reviews.push(review)
    await review.save()
    await campground.save()
    res.redirect(`/campgrounds/${campground._id}`)
}))

app.delete('/campgrounds/:id/reviews/:reviewId', catchAsync(async (req, res)=> {
    const {id, reviewId} = req.params;
    Campground.findByIdAndUpdate(id, {$pull : {reviews: reviewId}});
    await Review.findByIdAndDelete(req.params.reviewId) // just remove the review, but not the whole campground
    //res.send('delete!')
    res.redirect(`/campgrounds/${id}`)
}))

app.get('/campgrounds/:id',catchAsync(async(req, res)=>{
    const campground = await Campground.findById(req.params.id).populate('reviews')
    // console.log(campground)
    res.render('campgrounds/show', {campground})
}))

app.all('*', (req, res, next)=>{
    next(new ExpressError('Page not found', 404));
})

app.use((err, req, res, next)=>{
    const {statusCode = 500} = err;
    if(!err.message) err.message = "Something went wrong!"
    res.status(statusCode).render('error', {err})
    //res.send('Oh something went wrong!')
})

app.listen(3000, ()=>{
    console.log('Serving on the host 3000!')
})

/**
 * Related points:
 * 1. About the routers
 * https://expressjs.com/en/guide/routing.html
 * 
 * 2. Using middleware
 * https://expressjs.com/en/guide/using-middleware.html
 */

 