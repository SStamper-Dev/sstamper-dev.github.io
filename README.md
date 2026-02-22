# README

Hello! This is a GitHub repository for website hosting where the website will tell you a little about me!

THe name of the domain is hosted on is www.sethstamper.com, with www.sethstamper.com/3750 containing the applicaiton
This domain name was registered to me via NameCheap
I've employed the help of Netlify to host this repository.

Tech stack:
Client - HTML + CSS, JavaScript
Server - Python + Flask
Database - SQL

The database of choice is using MySQL which is hosted on Railway

To deploy and update the app locally:
In XAMPP's htdocs folder, create a folder titled 'sstamer' such that you now have a directory that looks like this: ...\xampp\htdocs\sstamper
Copy all files downloaded from my GitHub repository to your new 'sstamper' file
After starting Apache on your XAMPP application, copy and paste the following URL into your web browser of choice: http://localhost/sstamper (/3750 for the Solo Project 3 app)
Of course, for this, you will have to configure your own Python and SQL database for this (visit my other reposisotry for starter code: https://github.com/SStamper-Dev/crudbackend)

Or visit www.sethstamper.com/3750 on your web browser of choice to play around!

For Client -> Server, the API URL is publically displayed. However, the CORS on the python backend is configured to only allow requests from my specified domain. 
For Server -> Database, environment variables are saved into Railway where the Python backend can easily retrieve them from reference since they're both on the same private network.
