function activateVideo() {
    const container = document.getElementById('video-container');
    container.innerHTML = `
        <video controls playsinline autoplay class="portfolio-video">
            <source src="Team5milestone5#t=199" type="video/mp4">
        </video>
    `;
}