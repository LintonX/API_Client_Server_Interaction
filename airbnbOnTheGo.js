process.stdin.setEncoding("utf8")
const express = require("express")
const path = require("path")
const bodyParser = require('body-parser')
require("dotenv").config({path : path.resolve(__dirname, '.env')})
const app = express()

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set("views", path.resolve(__dirname, "templates"))
app.set("view engine", "ejs")

const userName = process.env.MONGO_DB_USERNAME
const password = process.env.MONGO_DB_PASSWORD
const dbName = process.env.MONGO_DB_NAME
const collection = process.env.MONGO_COLLECTION
const {MongoClient, ServerApiVersion} = require('mongodb')

if(process.argv.length !== 3){
    process.stdout.write("Usage airbnbOnTheGo.js port" + "\n")
    process.exit(1)
}

const port = process.argv[2]

process.stdout.write(`Web server started and running at http://localhost:${port}/Home` + "\n")
process.stdout.write(`Stop to shutdown the server: `)

const uri = `mongodb+srv://${userName}:${password}@cluster0.n52mfri.mongodb.net/?retryWrites=true&w=majority`
const client = new MongoClient(uri, {serverApi: ServerApiVersion.v1});

(async () => {
    try {
        await client.connect();
    } catch (err) {
        console.error('Error connecting to MongoDB:', err);
    }
})();

app.use(express.static(__dirname + '/'));

app.get("/Home", (request, response) => {
    response.render("index")
})

app.get("/Results", async (request, response) => {
    let location = request.query.searchLocation
    let numAdults = request.query.numAdults
    let checkin = request.query.checkIn
    let checkout = request.query.checkOut

    const url = `https://airbnb13.p.rapidapi.com/search-location?location=${location}&checkin=${checkin}&checkout=${checkout}&adults=${numAdults}&children=0&infants=0&pets=0&page=1&currency=USD`;
    const options = {
        method: 'GET',
        headers: {
            'X-RapidAPI-Key': 'aa4bd54e80mshd5a4f520708ea38p107fabjsn11d4af111210',
            'X-RapidAPI-Host': 'airbnb13.p.rapidapi.com'
        }
    };

    let results = await fetch(url, options)
    let stays = await results.json()

    if(stays){
        stays = stays.results
    }

    stays = stays.slice(0,9)

    let staysFormatted = ""

    let counter = 0

    stays.forEach((curr) => {
        staysFormatted += '<div id="unitContainer">'
        staysFormatted += `<span><em>${curr.name}</em></span><br><br>`
        staysFormatted += createImgSlider(counter, curr.images)
        staysFormatted += `<span>City: ${curr.city}</span><br>`
        staysFormatted += `<span>Bedrooms: ${curr.bedrooms}</span><br>`
        staysFormatted += `<span>Bathrooms: ${curr.bathrooms}</span><br>`
        staysFormatted += `<span>Rating: ${curr.rating}</span><br>`
        staysFormatted += `<span>Total price: $${curr.price.total}</span><br><br>`
        staysFormatted += `<form action="/re/${encodeURIComponent(curr.url)}" method="GET"><button type="submit" class="button-42">Book Now!</button></form>&nbsp`
        let crunchedObj = {name: curr.name, images: curr.images, city: curr.city, bedrooms: curr.bedrooms, bathrooms: curr.bathrooms, rating: curr.rating, total: curr.price.total, url: curr.url}
        let stringified = JSON.stringify(crunchedObj)
        staysFormatted += `<textarea id="hiddenEle${counter}" style="display:none;">${stringified}</textarea><button id="btn${counter}" class="button-42">Favorite</button>`
        staysFormatted += "</div><br>"
        counter++
    })

    response.render("results", {stays : staysFormatted})
}) 

app.post("/favorite", async (request, response) => {
    try{
        let result = await client.db(dbName).collection(collection).findOne({name : request.body.name})
        if(!result){
            await client.db(dbName).collection(collection).insertOne(request.body)
        }
        response.status(200).json({success: true, message: 'Succesfully added to favorites'});
    }catch(e){
        response.status(500).json({success: false, message: 'Failed to add to favorites. You may have already added this listing.'});
        console.error(e)
    }
})

app.get("/re/:url", (request, response) => {
    let reURL = decodeURIComponent(request.params.url);
    response.redirect(reURL);
})

app.get("/favorites", async (request, response) => {

    let cursor = await client.db(dbName).collection(collection).find()
    const result = await cursor.toArray()

    let favsFormattted = ""

    let counter = 0
    if(result){
        result.forEach((curr) => {
            favsFormattted += '<div id="unitContainer">'
            favsFormattted += `<span><em>${curr.name}</em></span><br><br>`
            favsFormattted += createImgSlider(counter, curr.images)
            favsFormattted += `<span>City: ${curr.city}</span><br>`
            favsFormattted += `<span>Bedrooms: ${curr.bedrooms}</span><br>`
            favsFormattted += `<span>Bathrooms: ${curr.bathrooms}</span><br>`
            favsFormattted += `<span>Rating: ${curr.rating}</span><br>`
            favsFormattted += `<span>Total price: $${curr.total}</span><br><br>`
            favsFormattted += `<form action="/re/${encodeURIComponent(curr.url)}" method="GET"><button type="submit" class="button-42">Book Now!</button></form>&nbsp`
            favsFormattted += "</div><br>"
            counter++
        })
        response.render("favorites", {favs : favsFormattted})
    }else{
        response.render("favorites", {favs : null})
    }
})

app.delete('/clearFavorites', async (request, response) => {
    try {
        await client.db(dbName).collection(collection).deleteMany({})
        response.json({success: true, message: 'Favorites cleared successfully.' });
    } catch (error) {
        console.error('Error clearing favorites:', error);
        response.json({success: false, message: 'Failed to clear favorites.' });
    }
});

function createImgSlider(cnt, images){
    let html = ""
    html += `<div class="wrapper${cnt}"><div class="gallery${cnt}">`
    let imgCnt = 0
    images.forEach(curr => {
        html += `<img class="gallery__img" id="${imgCnt}" src="${curr}"/>`
        imgCnt++
    })
    html += '</div></div>'
    return html
}

process.stdin.on("readable", async function(){
    let inputData = process.stdin.read()
    if(inputData !== null){
        let command = inputData.trim()
        if(command === "stop"){
            process.stdout.write("Shutting down the server" + "\n")
            await client.close()
            process.exit(0)
        }else{
            process.stdout.write("Stop to shutdown the server: ")
            process.stdin.resume()
        }
    }
})

app.listen(port)
