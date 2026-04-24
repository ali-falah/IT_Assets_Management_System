const bcrypt = require('bcrypt');
const start = Date.now();
const hash = '$2b$10$rztdqkwR8mya1Ga1kEf6QucLx6PDDZ86allbM9tKZ0aMNMZ83KrfC'; // admin@test.com hash
bcrypt.compare('admin', hash).then(res => {
    console.log('Result:', res);
    console.log('Time taken:', Date.now() - start, 'ms');
}).catch(err => {
    console.error('Error:', err);
});
