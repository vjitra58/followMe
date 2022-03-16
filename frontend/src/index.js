import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import {Provider} from 'react-redux';
import store from './store';
import {Provider as AlertProvider,positions, transitions} from 'react-alert'
import Template from 'react-alert-template-basic';

const options = {
  position: positions.BOTTOM_CENTER,
  timeout: 5000,
  transition: transitions.SCALE,
};

ReactDOM.render(
  <Provider store={store}>
    <React.StrictMode>
      <AlertProvider template={Template} {...options}>
        <App />
      </AlertProvider>
    </React.StrictMode>
  </Provider>,
  document.getElementById('root')
);
