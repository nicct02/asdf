class PortfolioAnalytics {
  constructor() {
    this.interactions = [];
    console.log('Portfolio Analytics initialized');
  }
  
  /**
   * Track user interaction
   * @param {string} category ccategory of interaction
   * @param {string} action Action performed
   * @param {Object} props additional properties to track
   */
  trackInteraction(category, action, props = {}) {
    const interaction = {
      timestamp: new Date().toISOString(),
      category,
      action,
      props
    };
    
    this.interactions.push(interaction);
    console.debug(`Analytics: ${category} ${action}`, props);
    
    //max 1000 interactions in memory
    if (this.interactions.length > 1000) {
      this.interactions = this.interactions.slice(-1000);
    }
  }

  getData() {
    return {
      totalInteractions: this.interactions.length,
      interactions: this.interactions
    };
  }

  clearData() {
    this.interactions = [];
  }
}

//Export global instance
export const portfolioAnalytics = new PortfolioAnalytics();

//available globally for debugging
window.portfolioAnalytics = portfolioAnalytics;