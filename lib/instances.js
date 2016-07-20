'use strict';

var fs = require('fs');
var path = require('path');
var util = require('util');
var builder = require('xmlbuilder');
var when = require('when');
var values = require('./values');
var utils = require('./utils');

/*
 Example:

 <?xml version="1.0"?>
 <Instance QualifiedName="some.qualified.path">
   <Fields>
      <Field Name="Field1">
         <Field Name="int_mem">
            <Value>
               <Type Name="int"/>
               <Simple value="64"/>
            </Value>
         </Field>
      </Field>
   </Fields>
 </Instance>
*/

//------------------------------------------------------------------------
function write(projectDirectory, inst) {
   return when.try(() => {
      var root = builder.create('Instance');
      root.att({QualifiedName: inst.qualifiedName, Model: inst.model.qualifiedName});
      var fields = root.ele('Fields');

      let opts = {
         wrapped: true,
         includeTypeInfo: false
      };

      for(let field of inst.fields) {
         var node = fields.ele('Field', { Name: field.name, IsInheriting: field.isInheriting });
         values.write(node, field.value, opts);
      }

      return root.end({ pretty: true, indent: '  ', newline: '\n' });
   })
   .then(xmlString => {
	   let filePath = utils.instToPath(projectDirectory, inst);
      utils.mkdirs(path.dirname(filePath));
      return utils.writeFile(filePath, xmlString);
   });
}

/*
* Loads all Models from a project
*
* @param {string} projectDirectory The project's directory
* @param {Project} project The project structure containing the Model definitions
* @return {Promise} Promise reflecting the Model loading state
*/
function read(projectDirectory, project) {
   let promises = [];

   for(let inst of project.instances) {
      let filePath = utils.instToPath(projectDirectory, inst);

      let promise = utils.readFile(filePath, 'utf8')
         .then(xml => utils.parseXml(xml))
         .then(xml => {
            let qname = xml.Model.$.QualifiedName;
            let members = xml.Model.Members.length == 0 ?
                  null :
                  xml.Model.Members[0].Member;

            if(members == null) {
               // No members
               return;
            }

            if(qname !== model.qualifiedName) {
               throw new Error('Stored Model QualifiedName does not match the project\'s table of contents');
            }

            for(let memberNode of members) {
               let name = memberNode.$.Name;
               let value = values.read(memberNode.Value[0]);
               model.members.new(name, value);
            }
         });

      promises.push(promise);
   }

   return when.all(promises);
}

/*
* List all instance files that will be generated for this run
*/
function *listFiles(project, projectDirectory) {
   for(let inst of project.instances) {
      yield utils.instToPath(projectDirectory, inst);
   }
}

//------------------------------------------------------------------------
module.exports = {
   write: write,
   read: read,
   listFiles: listFiles
};