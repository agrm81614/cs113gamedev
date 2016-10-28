var React = require('react'),
    ComponentTree = require('react-component-tree');

require('./InfoPanel.less');

class InfoPanel extends ComponentTree.Component {
  /**
   * Information panel for the Flatris game/Cosmos demo, shown in between game
   * states.
   */
  render() {
    // jscs:disable maximumLineLength
    return <div className="info-panel">
      <p className="large-text"><h1>Quadrix</h1> by Neoretro Games</p>
	  <p>Quadrix is a very fun game. Best of all time. More information to come.</p>
    </div>;
    // jscs:enable maximumLineLength
  }
}

module.exports = InfoPanel;
