# refrax-react  [![npm version](https://badge.fury.io/js/refrax-react.svg)](http://badge.fury.io/js/refrax-react)
Official React bindings for [Refrax](https://github.com/netarc/refrax).

## Installation

Refrax React requires **React 0.13 or later.**

```
npm install --save refrax-react
```

## Basic Usage

```js
import { createSchema, createSchemaCollection } from 'refrax'
import { createContainer } from 'refrax-react'
import { Component } from 'react'

const schema = createSchema();
schema.addLeaf(createSchemaCollection('users'));

class HelloWorldComponent extends Component {
  render() {
    return (
      <div>
        <h4>Users</h4>
        <ul>
          {this.showUsers()}
        </ul>
      </div>
    )
  }

  showUsers() {
    if (this.isLoading()) {
      return "...Loading..."
    }

    return this.props.users.map((user, i) => (
      <li key={i}>{user.name}</li>
    ))
  }
}

const HelloWorld = createContainer(HelloWorldComponent, function() {
  return {
    users: schema.users
  }
});

```

### License

Refrax React is [BSD licensed](./LICENSE).
