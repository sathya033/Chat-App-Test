

import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  let service: ChatService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ChatService]
    });
    service = TestBed.inject(ChatService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
      httpMock.verify();
  });

  it('should get users', () => {
    const mockUsers = [{ username: 'user1' }, { username: 'user2' }];

    service.getUsers().subscribe(users => expect(users).toEqual(mockUsers));
    const req = httpMock.expectOne('http://localhost:5000/api/users');
    expect(req.request.method).toBe('GET');
    req.flush(mockUsers);
  });

  it('should fetch groups for a user', () => {
    const username = 'testUser', mockGroups = [{ groupName: 'group1' }, { groupName: 'group2' }];

    service.getGroups(username).subscribe(groups => expect(groups).toEqual(mockGroups));
    const req = httpMock.expectOne(`http://localhost:5000/chat/groups?username=${encodeURIComponent(username)}`);
    expect(req.request.method).toBe('GET');
    req.flush(mockGroups);
  });

  it('should fetch chat history', () => {
    const [user1, user2] = ['user1', 'user2'], mockMessages = [{ sender: user1, receiver: user2, message: 'Hello' }];

    service.getChatHistory(user1, user2).subscribe(messages => expect(messages).toEqual(mockMessages));
    const req = httpMock.expectOne(`http://localhost:5000/chat/messages/${user1}/${user2}`);
    expect(req.request.method).toBe('GET');
    req.flush(mockMessages);
  });

  it('should fetch group chat history', () => {
    const groupName = 'group1', mockMessages = [{ sender: 'user1', message: 'Hello' }];

    service.getGroupChatHistory(groupName).subscribe(messages => expect(messages).toEqual(mockMessages));
    const req = httpMock.expectOne(`http://localhost:5000/chat/groups/messages/${encodeURIComponent(groupName)}`);
    expect(req.request.method).toBe('GET');
    req.flush(mockMessages);
  });

  it('should create a new group', () => {
    const groupData = { groupName: 'newGroup', admin: 'adminUser' }, mockResponse = { success: true };

    service.createGroup(groupData).subscribe(response => expect(response).toEqual(mockResponse));
    const req = httpMock.expectOne('http://localhost:5000/chat/groups/create');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(groupData);
    req.flush(mockResponse);
  });

  it('should add a user to a group', () => {
    const groupData = { groupName: 'group1', username: 'newUser' }, mockResponse = { success: true };

    service.addUserToGroup(groupData).subscribe(response => expect(response).toEqual(mockResponse));
    const req = httpMock.expectOne('http://localhost:5000/chat/groups/add-user');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(groupData);
    req.flush(mockResponse);
  });

  it('should mark messages as read', () => {
    const [currentUser, sender] = ['user1', 'user2'], mockResponse = { success: true };

    service.markMessagesAsRead(currentUser, sender).subscribe(response => expect(response).toEqual(mockResponse));
    const req = httpMock.expectOne(`http://localhost:5000/chat/messages/read/${sender}/${currentUser}`);
    expect(req.request.method).toBe('PUT');
    req.flush(mockResponse);
  });

  it('should mark group messages as read', () => {
    const [groupName, username] = ['group1', 'user1'], mockResponse = { success: true };

    service.markGroupMessagesAsRead(groupName, username).subscribe(response => expect(response).toEqual(mockResponse));
    const req = httpMock.expectOne(`http://localhost:5000/chat/groups/messages/read/${groupName}/${username}`);
    expect(req.request.method).toBe('PUT');
    req.flush(mockResponse);
  });

  it('should send a private message', () => {
    spyOn(service['socket'], 'emit');
    service.sendPrivateMessage('user2', 'Hello');
    expect(service['socket'].emit).toHaveBeenCalledWith('send_private_message', jasmine.objectContaining({ message: 'Hello' }));
  });

  it('should send a group message', () => {
    spyOn(service['socket'], 'emit');
    service.sendGroupMessage('group1', 'Hello Group');
    expect(service['socket'].emit).toHaveBeenCalledWith('send_group_message', jasmine.objectContaining({ message: 'Hello Group' }));
  });

  it('should join and leave a group', () => {
    spyOn(service['socket'], 'emit');
    service.joinGroup('group1');
    expect(service['socket'].emit).toHaveBeenCalledWith('join_group', jasmine.objectContaining({ group: 'group1' }));

    service.leaveGroup('group1');
    expect(service['socket'].emit).toHaveBeenCalledWith('leave_group', jasmine.objectContaining({ group: 'group1' }));
  });

  it('should emit typing status', () => {
      spyOn(service['socket'], 'emit');

    service.emitTyping('user2', true);
    expect(service['socket'].emit).toHaveBeenCalledWith('typing', jasmine.objectContaining({ receiver: 'user2' }));

    service.emitTyping('user2', false);
    expect(service['socket'].emit).toHaveBeenCalledWith('stop_typing', jasmine.objectContaining({ receiver: 'user2' }));
  });

  

  it('should emit group typing status', () => {
      spyOn(service['socket'], 'emit');

    service.emitGroupTyping('group1', true);
    expect(service['socket'].emit).toHaveBeenCalledWith('typing_group', jasmine.objectContaining({ group: 'group1' }));

    service.emitGroupTyping('group1', false);
    expect(service['socket'].emit).toHaveBeenCalledWith('stop_typing_group', jasmine.objectContaining({ group: 'group1' }));
  });

  it('should fetch unread message count', () => {
    const username = 'user1', mockCount = { count: 5 };

    service.getUnreadMessageCount(username).subscribe(count => expect(count).toEqual(mockCount));
    const req = httpMock.expectOne(`http://localhost:5000/chat/messages/unread/${username}`);
    expect(req.request.method).toBe('GET');
    req.flush(mockCount);
  });

  it('should fetch group unread message count', () => {
    const [groupName, username] = ['group1', 'user1'], mockCount = { count: 3 };

    service.getGroupUnreadCount(groupName, username).subscribe(count => expect(count).toEqual(mockCount));
    const req = httpMock.expectOne(`http://localhost:5000/chat/groups/unread/${groupName}/${username}`);
    expect(req.request.method).toBe('GET');
    req.flush(mockCount);
  });

  it('should disconnect the socket', () => {
    spyOn(service['socket'], 'disconnect');
    service.disconnect();
    expect(service['socket'].disconnect).toHaveBeenCalled();
  });

  it('should update messages', () => {
    const messages = [{ sender: 'user1', message: 'Hello' }];
    service.updateMessages(messages);
    service.getMessages().subscribe(updatedMessages => expect(updatedMessages).toEqual(messages));
  });
});




// import { TestBed } from '@angular/core/testing';
// import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

// import { ChatService } from './chat.service';


// describe('ChatService', () => {
//   let service: ChatService;
//   let httpMock: HttpTestingController;

//   beforeEach(() => {
//     TestBed.configureTestingModule({
//       imports: [HttpClientTestingModule],
//       providers: [ChatService]
//     });
//     service = TestBed.inject(ChatService);
//     httpMock = TestBed.inject(HttpTestingController);
//   });

//   afterEach(() => {
//     httpMock.verify();
//   });


//   it(' get users', () => {
//     const mockUsers = [{ username: 'user1' }, { username: 'user2' }];

//     service.getUsers().subscribe(users => {
//       expect(users).toEqual(mockUsers);
//     });

//     const req = httpMock.expectOne('http://localhost:5000/api/users');
//     expect(req.request.method).toBe('GET');
//     req.flush(mockUsers);
//   });

//   it(' fetch groups for a user', () => {
//     const mockGroups = [{ groupName: 'group1' }, { groupName: 'group2' }];
//     const username = 'testUser';

//     service.getGroups(username).subscribe(groups => {
//       expect(groups).toEqual(mockGroups);
//     });

//     const req = httpMock.expectOne(`http://localhost:5000/chat/groups?username=${encodeURIComponent(username)}`);
//     expect(req.request.method).toBe('GET');
//     req.flush(mockGroups);
//   });

//   it(' fetch chat history between two users', () => {
//     const mockMessages = [{ sender: 'user1', receiver: 'user2', message: 'Hello' }];
//     const user1 = 'user1';
//     const user2 = 'user2';

//     service.getChatHistory(user1, user2).subscribe(messages => {
//       expect(messages).toEqual(mockMessages);
//     });

//     const req = httpMock.expectOne(`http://localhost:5000/chat/messages/${user1}/${user2}`);
//     expect(req.request.method).toBe('GET');
//     req.flush(mockMessages);
//   });

//   it(' fetch group chat history', () => {
//     const mockMessages = [{ sender: 'user1', group: 'group1', message: 'Hello' }];
//     const groupName = 'group1';

//     service.getGroupChatHistory(groupName).subscribe(messages => {
//       expect(messages).toEqual(mockMessages);
//     });

//     const req = httpMock.expectOne(`http://localhost:5000/chat/groups/messages/${encodeURIComponent(groupName)}`);
//     expect(req.request.method).toBe('GET');
//     req.flush(mockMessages);
//   });

//   it(' create a new group', () => {
//     const mockResponse = { success: true };
//     const groupData = { groupName: 'newGroup', admin: 'adminUser' };

//     service.createGroup(groupData).subscribe(response => {
//       expect(response).toEqual(mockResponse);
//     });

//     const req = httpMock.expectOne('http://localhost:5000/chat/groups/create');
//     expect(req.request.method).toBe('POST');
//     expect(req.request.body).toEqual(groupData);
//     req.flush(mockResponse);
//   });

//   it(' add a user to a group', () => {
//     const mockResponse = { success: true };
//     const groupData = { groupName: 'group1', username: 'newUser' };

//     service.addUserToGroup(groupData).subscribe(response => {
//       expect(response).toEqual(mockResponse);
//     });

//     const req = httpMock.expectOne('http://localhost:5000/chat/groups/add-user');
//     expect(req.request.method).toBe('POST');
//     expect(req.request.body).toEqual(groupData);
//     req.flush(mockResponse);
//   });

//   it(' mark messages as read', () => {
//     const mockResponse = { success: true };
//     const currentUser = 'user1';
//     const sender = 'user2';

//     service.markMessagesAsRead(currentUser, sender).subscribe(response => {
//       expect(response).toEqual(mockResponse);
//     });

//     const req = httpMock.expectOne(`http://localhost:5000/chat/messages/read/${sender}/${currentUser}`);
//     expect(req.request.method).toBe('PUT');
//     req.flush(mockResponse);
//   });

//   it(' mark group messages as read', () => {
//     const mockResponse = { success: true };
//     const groupName = 'group1';
//     const username = 'user1';

//     service.markGroupMessagesAsRead(groupName, username).subscribe(response => {
//       expect(response).toEqual(mockResponse);
//     });

//     const req = httpMock.expectOne(`http://localhost:5000/chat/groups/messages/read/${groupName}/${username}`);
//     expect(req.request.method).toBe('PUT');
//     req.flush(mockResponse);
//   });

//   // it (" multiply two numbers", () => {
//   //   // const service = new ChatService();
//   //   // expect(service.multiply(2, 5)).toBe(10);
//   //   const result = service.multiply(2, 5);
//   //   expect(result).toBe(10);
//   // });

//   it(' send a private message', () => {
//     const receiver = 'user2';
//     const message = 'Hello';
//     spyOn(service['socket'], 'emit');

//     service.sendPrivateMessage(receiver, message);

//     expect(service['socket'].emit).toHaveBeenCalledWith('send_private_message', {
//       sender: service['currentUser'],
//       receiver,
//       message,
//       timestamp: jasmine.any(Date)
//     });
//   });

//   it(' send a group message', () => {
//     const groupName = 'group1';
//     const message = 'Hello Group';
//     spyOn(service['socket'], 'emit');

//     service.sendGroupMessage(groupName, message);

//     expect(service['socket'].emit).toHaveBeenCalledWith('send_group_message', {
//       sender: service['currentUser'],
//       group: groupName,
//       message,
//       timestamp: jasmine.any(Date),
//       readBy: [service['currentUser']]
//     });
//   });

//   it(' join a group', () => {
//     const groupName = 'group1';
//     spyOn(service['socket'], 'emit');

//     service.joinGroup(groupName);

//     expect(service['socket'].emit).toHaveBeenCalledWith('join_group', {
//       group: groupName,
//       user: service['currentUser']
//     });
//   });

//   it(' leave a group', () => {
//     const groupName = 'group1';
//     spyOn(service['socket'], 'emit');

//     service.leaveGroup(groupName);

//     expect(service['socket'].emit).toHaveBeenCalledWith('leave_group', {
//       group: groupName,
//       user: service['currentUser']
//     });
//   });

//   it(' emit typing status for private chat', () => {
//     const receiver = 'user2';
//     spyOn(service['socket'], 'emit');

//     service.emitTyping(receiver, true);

//     expect(service['socket'].emit).toHaveBeenCalledWith('typing', {
//       sender: service['currentUser'],
//       receiver
//     });

//     service.emitTyping(receiver, false);

//     expect(service['socket'].emit).toHaveBeenCalledWith('stop_typing', {
//       sender: service['currentUser'],
//       receiver
//     });
//   });

//   it(' emit typing status for group chat', () => {
//     const groupName = 'group1';
//     spyOn(service['socket'], 'emit');

//     service.emitGroupTyping(groupName, true);

//     expect(service['socket'].emit).toHaveBeenCalledWith('typing_group', {
//       sender: service['currentUser'],
//       group: groupName
//     });

//     service.emitGroupTyping(groupName, false);

//     expect(service['socket'].emit).toHaveBeenCalledWith('stop_typing_group', {
//       sender: service['currentUser'],
//       group: groupName
//     });
//   });

//   it(' fetch unread message count', () => {
//     const username = 'user1';
//     const mockCount = { count: 5 };

//     service.getUnreadMessageCount(username).subscribe(count => {
//       expect(count).toEqual(mockCount);
//     });

//     const req = httpMock.expectOne(`http://localhost:5000/chat/messages/unread/${username}`);
//     expect(req.request.method).toBe('GET');
//     req.flush(mockCount);
//   });

//   it(' fetch group unread message count', () => {
//     const groupName = 'group1';
//     const username = 'user1';
//     const mockCount = { count: 3 };

//     service.getGroupUnreadCount(groupName, username).subscribe(count => {
//       expect(count).toEqual(mockCount);
//     });


//     const req = httpMock.expectOne(`http://localhost:5000/chat/groups/unread/${groupName}/${username}`);
//     expect(req.request.method).toBe('GET');
//     req.flush(mockCount);
//   });

//   it(' disconnect the socket', () => {
//     spyOn(service['socket'], 'disconnect');

//     service.disconnect();

//     expect(service['socket'].disconnect).toHaveBeenCalled();
//   });

//   it(' update messages', () => {
//     const messages = [{ sender: 'user1', message: 'Hello' }];

//     service.updateMessages(messages);

//     service.getMessages().subscribe(updatedMessages => {
//       expect(updatedMessages).toEqual(messages);
//     });
//   });

// });
