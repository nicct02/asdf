class Overlays {
  constructor(portfolioAnalytics = null) {
    this.portfolioAnalytics = portfolioAnalytics || {
      trackInteraction: () => {}
    };
    
    this.paperReadingMode = false;
    this.paperOverlay = null;
    this.tombstoneOverlay = null;
    this.bookOverlay = null;
    this.scrollOverlay = null;
    
    //all overlays
    this.createPaperOverlay();
    this.createTombstoneOverlay();
    this.createBookOverlay();
    this.createScrollOverlay();
    
    //form submission
    this.formSubmissionSetup = false;
    
    //Keyboard handler for ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.paperReadingMode) {
        //close any open overlay when pressed
        if (this.paperOverlay.style.display === 'block') this.closePaper();
        if (this.tombstoneOverlay.style.display === 'block') this.closeTombstone();
        if (this.bookOverlay.style.display === 'block') this.closeBook();
        if (this.scrollOverlay.style.display === 'block') this.closeScroll();
      }
    });
  }
  
  isPaperReadingMode() {
    return this.paperReadingMode;
  }
  
   createPaperOverlay() {
    this.paperOverlay = document.createElement('div');
    this.paperOverlay.id = 'paper-overlay';
    this.paperOverlay.style.cssText = `
      position: fixed;
      top: 100px;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #f4f1e8 0%, #e8dcc0 100%);
      background-image: 
        radial-gradient(circle at 20% 50%, rgba(139, 69, 19, 0.05) 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, rgba(139, 69, 19, 0.05) 0%, transparent 50%),
        radial-gradient(circle at 40% 80%, rgba(139, 69, 19, 0.05) 0%, transparent 50%);
      z-index: 4000;
      display: none;
      overflow: hidden;
    `;

    const paperContainer = document.createElement('div');
    paperContainer.style.cssText = `
      position: relative;
      max-width: 400px;
      height: 30%;
      margin: 0 auto;
      background: #f9f7f1;
      box-shadow: 0 0 50px rgba(0, 0, 0, 0.3);
      border-left: 1px solid #ddd;
      border-right: 1px solid #ddd;
      overflow-y: auto;
      padding: 60px 80px 40px 80px;
      box-sizing: border-box;
    `;

    const closeButton = document.createElement('button');
    closeButton.id = 'paper-close-btn';
    closeButton.innerHTML = '✕';
    closeButton.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 50px;
      height: 50px;
      background: rgba(139, 69, 19, 0.8);
      border: none;
      border-radius: 50%;
      color: white;
      font-size: 24px;
      font-weight: bold;
      cursor: pointer;
      z-index: 4001;
      transition: all 0.3s ease;
    `;

    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = 'rgba(139, 69, 19, 1)';
      closeButton.style.transform = 'scale(1.1)';
    });

    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = 'rgba(139, 69, 19, 0.8)';
      closeButton.style.transform = 'scale(1)';
    });

    closeButton.addEventListener('click', () => {
      this.closePaper();
      if (typeof window.onOverlayClose === 'function') {
        window.onOverlayClose();
      }
    });

    const paperContent = document.createElement('div');
    paperContent.style.cssText = `
      font-family: 'Georgia', 'Times New Roman', serif;
      color: #2c1810;
      line-height: 1.8;
      font-size: 16px;
      text-align: justify;
    `;

    paperContent.innerHTML = `
      <h1 style="text-align: center; margin-bottom: 30px; color: #1a0e08; font-size: 28px; text-shadow: 1px 1px 2px rgba(0,0,0,0.1);">
        Fuck AI Art.
      </h1>
      
      <div style="height: 100px;"></div>
    `;

    paperContainer.appendChild(paperContent);
    this.paperOverlay.appendChild(paperContainer);
    this.paperOverlay.appendChild(closeButton);
        document.body.appendChild(this.paperOverlay);
  }
  
  createTombstoneOverlay() {
    this.tombstoneOverlay = document.createElement('div');
    this.tombstoneOverlay.id = 'tombstone-overlay';
    this.tombstoneOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%);
      background-image: 
        radial-gradient(circle at 30% 40%, rgba(64, 64, 64, 0.3) 0%, transparent 50%),
        radial-gradient(circle at 70% 80%, rgba(32, 32, 32, 0.4) 0%, transparent 50%);
      z-index: 4000;
      display: none;
      overflow: hidden;
    `;

    const tombstoneContainer = document.createElement('div');
    tombstoneContainer.style.cssText = `
      position: relative;
      max-width: 700px;
      height: 100%;
      margin: 0 auto;
      background: linear-gradient(145deg, #4a4a4a, #2d2d2d);
      box-shadow: 
        0 0 50px rgba(0, 0, 0, 0.8),
        inset 0 0 20px rgba(255, 255, 255, 0.1);
      border: 3px solid #666;
      border-radius: 15px;
      overflow-y: auto;
      padding: 40px 60px;
      box-sizing: border-box;
      margin-top: 50px;
      margin-bottom: 50px;
      height: calc(100vh - 100px);
    `;

    const tombstoneCloseButton = document.createElement('button');
    tombstoneCloseButton.id = 'tombstone-close-btn';
    tombstoneCloseButton.innerHTML = '✕';
    tombstoneCloseButton.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 50px;
      height: 50px;
      background: rgba(64, 64, 64, 0.9);
      border: 2px solid #888;
      border-radius: 50%;
      color: #ccc;
      font-size: 24px;
      font-weight: bold;
      cursor: pointer;
      z-index: 4001;
      transition: all 0.3s ease;
    `;

    tombstoneCloseButton.addEventListener('mouseenter', () => {
      tombstoneCloseButton.style.background = 'rgba(96, 96, 96, 1)';
      tombstoneCloseButton.style.transform = 'scale(1.1)';
      tombstoneCloseButton.style.color = '#fff';
    });

    tombstoneCloseButton.addEventListener('mouseleave', () => {
      tombstoneCloseButton.style.background = 'rgba(64, 64, 64, 0.9)';
      tombstoneCloseButton.style.transform = 'scale(1)';
      tombstoneCloseButton.style.color = '#ccc';
    });

    tombstoneCloseButton.addEventListener('click', () => {
      this.closeTombstone();
      if (typeof window.onOverlayClose === 'function') {
        window.onOverlayClose();
      }
    });

    const tombstoneContent = document.createElement('div');
    tombstoneContent.style.cssText = `
      font-family: 'Courier New', monospace;
      color: #e0e0e0;
      line-height: 1.6;
      font-size: 14px;
      text-align: left;
    `;

    tombstoneContent.innerHTML = `
      <div style="text-align: center; margin-bottom: 40px;">
        <h1 style="color: #ccc; font-size: 24px; margin-bottom: 10px; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">
          about page oder so idk who-the-fuck-is-this-person-who-made-this-bs-here maybe in a less self deprecating way lol
        </h1>
      </div>
    `;

    tombstoneContainer.appendChild(tombstoneContent);
    this.tombstoneOverlay.appendChild(tombstoneContainer);
    this.tombstoneOverlay.appendChild(tombstoneCloseButton);
     document.body.appendChild(this.tombstoneOverlay);
  }


  
  createBookOverlay() {
    this.bookOverlay = document.createElement('div');
    this.bookOverlay.id = 'book-overlay';
    this.bookOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #2a1810 0%, #1a1008 100%);
      background-image: 
        radial-gradient(circle at 25% 30%, rgba(139, 69, 19, 0.1) 0%, transparent 50%),
        radial-gradient(circle at 75% 70%, rgba(218, 165, 32, 0.05) 0%, transparent 50%);
      z-index: 4000;
      display: none;
      overflow: hidden;
    `;

    const bookContainer = document.createElement('div');
    bookContainer.style.cssText = `
      position: relative;
      max-width: 750px;
      height: 100%;
      margin: 0 auto;
      background: linear-gradient(145deg, #3d2f1f, #2a1e10);
      box-shadow: 
        0 0 60px rgba(139, 69, 19, 0.4),
        inset 0 0 30px rgba(218, 165, 32, 0.1);
      border: 3px solid #8b4513;
      border-radius: 10px;
      overflow-y: auto;
      padding: 50px 70px;
      box-sizing: border-box;
      margin-top: 40px;
      margin-bottom: 40px;
      height: calc(100vh - 80px);
    `;

    const bookCloseButton = document.createElement('button');
    bookCloseButton.id = 'book-close-btn';
    bookCloseButton.innerHTML = '✕';
    bookCloseButton.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 50px;
      height: 50px;
      background: rgba(139, 69, 19, 0.9);
      border: 2px solid #d4af37;
      border-radius: 50%;
      color: #f4e4c1;
      font-size: 24px;
      font-weight: bold;
      cursor: pointer;
      z-index: 4001;
      transition: all 0.3s ease;
    `;

    bookCloseButton.addEventListener('mouseenter', () => {
      bookCloseButton.style.background = 'rgba(139, 69, 19, 1)';
      bookCloseButton.style.transform = 'scale(1.1)';
      bookCloseButton.style.color = '#fff';
    });

    bookCloseButton.addEventListener('mouseleave', () => {
      bookCloseButton.style.background = 'rgba(139, 69, 19, 0.9)';
      bookCloseButton.style.transform = 'scale(1)';
      bookCloseButton.style.color = '#f4e4c1';
    });

    bookCloseButton.addEventListener('click', () => {
      this.closeBook();
      if (typeof window.onOverlayClose === 'function') {
        window.onOverlayClose();
      }
    });

    const bookContent = document.createElement('div');
    bookContent.style.cssText = `
      font-family: 'Times New Roman', serif;
      color: #f4e4c1;
      line-height: 1.7;
      font-size: 15px;
      text-align: left;
    `;

    bookContent.innerHTML = `
      <div style="text-align: center; margin-bottom: 40px;">
        <h1 style="color: #d4af37; font-size: 26px; margin-bottom: 15px; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">
          contact here. evtl socials auch wenn iwann mal aktiv
        </h1>
      </div>
    `;

    bookContainer.appendChild(bookContent);
    this.bookOverlay.appendChild(bookContainer);
    this.bookOverlay.appendChild(bookCloseButton);
    document.body.appendChild(this.bookOverlay);
  }
  
  
  createScrollOverlay() {
    this.scrollOverlay = document.createElement('div');
    this.scrollOverlay.id = 'scroll-overlay';
    this.scrollOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #2a1810 0%, #1a1008 100%);
      background-image: 
        radial-gradient(circle at 30% 40%, rgba(139, 69, 19, 0.15) 0%, transparent 50%),
        radial-gradient(circle at 70% 80%, rgba(218, 165, 32, 0.08) 0%, transparent 50%);
      z-index: 4000;
      display: none;
      overflow: hidden;
    `;

    const scrollContainer = document.createElement('div');
    scrollContainer.style.cssText = `
      position: relative;
      max-width: 600px;
      height: auto;
      margin: 50px auto;
      background: linear-gradient(145deg, #3d2f1f, #2a1e10);
      box-shadow: 
        0 0 60px rgba(139, 69, 19, 0.5),
        inset 0 0 30px rgba(218, 165, 32, 0.1);
      border: 3px solid #8b4513;
      border-radius: 15px;
      padding: 40px;
      box-sizing: border-box;
    `;

    const scrollCloseButton = document.createElement('button');
    scrollCloseButton.id = 'scroll-close-btn';
    scrollCloseButton.innerHTML = '✕';
    scrollCloseButton.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 50px;
      height: 50px;
      background: rgba(139, 69, 19, 0.9);
      border: 2px solid #d4af37;
      border-radius: 50%;
      color: #f4e4c1;
      font-size: 24px;
      font-weight: bold;
      cursor: pointer;
      z-index: 4001;
      transition: all 0.3s ease;
    `;

    scrollCloseButton.addEventListener('mouseenter', () => {
      scrollCloseButton.style.background = 'rgba(139, 69, 19, 1)';
      scrollCloseButton.style.transform = 'scale(1.1)';
      scrollCloseButton.style.color = '#fff';
    });

    scrollCloseButton.addEventListener('mouseleave', () => {
      scrollCloseButton.style.background = 'rgba(139, 69, 19, 0.9)';
      scrollCloseButton.style.transform = 'scale(1)';
      scrollCloseButton.style.color = '#f4e4c1';
    });

    scrollCloseButton.addEventListener('click', () => {
      this.closeScroll();
      if (typeof window.onOverlayClose === 'function') {
        window.onOverlayClose();
      }
    });

    const scrollContent = document.createElement('div');
    scrollContent.style.cssText = `
      font-family: 'Times New Roman', serif;
      color: #f4e4c1;
      line-height: 1.6;
      font-size: 16px;
    `;

    scrollContent.innerHTML = `
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 style="color: #d4af37; font-size: 28px; margin-bottom: 10px; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">
          anonymus feedback
        </h2>
        <div style="color: #b8860b; font-style: italic;">finally works. fuck yeah</div>
      </div>
      
      <form id="feedback-form" action="https://formspree.io/f/xovwrear" method="POST">
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; color: #d4af37; font-weight: bold;">msg:</label>
          <textarea 
            name="message" 
            placeholder="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
            style="width: 100%; height: 120px; padding: 15px; background: #1a1008; 
                   color: #f4e4c1; border: 2px solid #8b4513; border-radius: 8px;
                   font-family: 'Times New Roman', serif; resize: vertical; font-size: 15px;
                   box-sizing: border-box;"
            required>    
          </textarea>
        </div>
        
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; color: #d4af37; font-weight: bold;">name/sender (aka second column on frmsp. layout):</label>
          <input 
            type="text" 
            name="name" 
            placeholder="name"
            style="width: 100%; padding: 12px; background: #1a1008; 
                   color: #f4e4c1; border: 2px solid #8b4513; border-radius: 8px;
                   font-family: 'Times New Roman', serif; font-size: 15px;
                   box-sizing: border-box;">
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <button type="submit" id="submit-btn" style="background: linear-gradient(145deg, #8b4513, #6b3410); 
                  color: #f4e4c1; padding: 15px 40px; border: none; border-radius: 8px; 
                  font-family: 'Times New Roman', serif; font-size: 16px; font-weight: bold;
                  cursor: pointer; transition: all 0.3s ease; box-shadow: 0 4px 8px rgba(0,0,0,0.3);">
            yeet.
          </button>
        </div>
        
        <div id="form-status" style="margin-top: 20px; text-align: center; display: none;"></div>
      </form>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #8b4513; text-align: center;">
        <p style="color: #b8860b; font-style: italic; margin: 0; font-size: 14px;">
          " "
        </p>
      </div>
    `;

    scrollContainer.appendChild(scrollContent);
    this.scrollOverlay.appendChild(scrollContainer);
    this.scrollOverlay.appendChild(scrollCloseButton);
    document.body.appendChild(this.scrollOverlay);
  }
  
  setupFormSubmission() {
    if (this.formSubmissionSetup) {
      return;
    }
    
    const form = document.getElementById('feedback-form');
    const submitBtn = document.getElementById('submit-btn');
    const formStatus = document.getElementById('form-status');
    
    if (form) {
      let isSubmitting = false; // Per-session flag to prevent rapid double-clicks
      
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Prevent rapid double-clicks
        if (isSubmitting) {
          console.log('Form already submitting, ignoring duplicate submission');
          return;
        }
        //form data
        const formData = new FormData(form);
        const message = formData.get('message').trim();
        
        // Check if message empty
        if (!message || message.length < 3) {
          formStatus.innerHTML = `
            <div style="color: #ff6b6b; background: rgba(255, 107, 107, 0.1); 
                        padding: 15px; border-radius: 8px; border: 1px solid #ff6b6b;">
              <strong>nu uh. write something.</strong><br>
              <small>at least 3 characters</small>
            </div>
          `;
          formStatus.style.display = 'block';
          return;
        }
        //submitting flag
        isSubmitting = true;
        
        // Update button
        submitBtn.innerHTML = 'yeeting...';
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.7';
        submitBtn.style.cursor = 'not-allowed';
        
        // Hide previous status
        formStatus.style.display = 'none';
        
        try {
          const response = await fetch(form.action, {
            method: 'POST',
            body: formData,
            headers: {
              'Accept': 'application/json'
            }
          });
          
          if (response.ok) {
            if (this.portfolioAnalytics) {
              this.portfolioAnalytics.trackInteraction('feedback_form', 'submit_success', {
                messageLength: message.length,
                hasName: !!formData.get('name')
              });
            }
            
            // Success
            formStatus.innerHTML = `
              <div style="color: #90ee90; background: rgba(144, 238, 144, 0.1); 
                          padding: 15px; border-radius: 8px; border: 1px solid #90ee90;">
                <strong>yeeted.</strong><br>
                <small> </small>
              </div>
            `;
            form.reset();
            
            // Auto-close scroll after submission
            setTimeout(() => {
              this.closeScroll();
              // Call the global callback function after closing
              if (typeof window.onOverlayClose === 'function') {
                window.onOverlayClose();
              }
            }, 3000);
            
          } else {
            throw new Error('Form submission failed');
          }
        } catch (error) {
          console.error('Form submission error:', error);
          formStatus.innerHTML = `
            <div style="color: #ff6b6b; background: rgba(255, 107, 107, 0.1); 
                        padding: 15px; border-radius: 8px; border: 1px solid #ff6b6b;">
              <strong> didnt work</strong><br>
              <small> try again</small>
            </div>
          `;
        } finally {
          //Reset submitting flag
          isSubmitting = false;
          submitBtn.innerHTML = 'yeet.';
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
          submitBtn.style.cursor = 'pointer';
          formStatus.style.display = 'block';
        }
      });
      
      this.formSubmissionSetup = true;
      console.log('Form submission handler attached');
    }
  }
  
  openPaper() {
    this.paperReadingMode = true;
    this.paperOverlay.style.display = 'block';
    
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    
    if (this.portfolioAnalytics) {
      this.portfolioAnalytics.trackInteraction('overlay', 'open_paper');
    }
  }
  
  closePaper() {
    this.paperOverlay.style.display = 'none';
    this.paperReadingMode = false;
    
    if (this.portfolioAnalytics) {
      this.portfolioAnalytics.trackInteraction('overlay', 'close_paper');
    }
  }
  
  openTombstone() {
    this.paperReadingMode = true;
    this.tombstoneOverlay.style.display = 'block';
    
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    
    if (this.portfolioAnalytics) {
      this.portfolioAnalytics.trackInteraction('overlay', 'open_tombstone');
    }
  }
  
  closeTombstone() {
    this.tombstoneOverlay.style.display = 'none';
    this.paperReadingMode = false;
    
    if (this.portfolioAnalytics) {
      this.portfolioAnalytics.trackInteraction('overlay', 'close_tombstone');
    }
  }
  
  openBook() {
    this.paperReadingMode = true;
    this.bookOverlay.style.display = 'block';
    
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    
    if (this.portfolioAnalytics) {
      this.portfolioAnalytics.trackInteraction('overlay', 'open_book');
    }
  }
  
  closeBook() {
    this.bookOverlay.style.display = 'none';
    this.paperReadingMode = false;
    
    if (this.portfolioAnalytics) {
      this.portfolioAnalytics.trackInteraction('overlay', 'close_book');
    }
  }
  
  openScroll() {
    this.paperReadingMode = true;
    this.scrollOverlay.style.display = 'block';
    
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    
    if (this.portfolioAnalytics) {
      this.portfolioAnalytics.trackInteraction('overlay', 'open_scroll');
    }
    
    this.setupFormSubmission();
  }
  
  closeScroll() {
    this.scrollOverlay.style.display = 'none';
    this.paperReadingMode = false;
    
    if (this.portfolioAnalytics) {
      this.portfolioAnalytics.trackInteraction('overlay', 'close_scroll');
    }
  }
}

export { Overlays };