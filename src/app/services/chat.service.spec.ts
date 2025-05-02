import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ChatService } from './chat.service';
import { io } from 'socket.io-client';

jest.mock('socket.io-client');

describe('ChatService', () => {
  let service: ChatService;
  let httpMock: HttpTestingController;
  let mockSocket: any;

  beforeEach(() => {
    mockSocket = {
      on: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
      connect: jest.fn(),
    };
    (io as jest.Mock).mockReturnValue(mockSocket);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ChatService],
    });
    service = TestBed.inject(ChatService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should get users', () => {
    const mockUsers = [{ username: 'user1' }, { username: 'user2' }];

    service.getUsers().subscribe(users => {
      expect(users).toEqual(mockUsers);
    });

    const req = httpMock.expectOne('http://localhost:5000/api/users');
    expect(req.request.method).toBe('GET');
    req.flush(mockUsers);
  });

  it('should fetch groups for a user', () => {
    const username = 'testUser';
    const mockGroups = [{ groupName: 'group1' }, { groupName: 'group2' }];

    service.getGroups(username).subscribe(groups => {
      expect(groups).toEqual(mockGroups);
    });

    const req = httpMock.expectOne(`http://localhost:5000/chat/groups?username=${encodeURIComponent(username)}`);
    expect(req.request.method).toBe('GET');
    req.flush(mockGroups);
  });

  it('should fetch chat history', () => {
    const user1 = 'user1';
    const user2 = 'user2';
    const mockMessages = [{ sender: user1, receiver: user2, message: 'Hello' }];

    service.getChatHistory(user1, user2).subscribe(messages => {
      expect(messages).toEqual(mockMessages);
    });

    const req = httpMock.expectOne(`http://localhost:5000/chat/messages/${user1}/${user2}`);
    expect(req.request.method).toBe('GET');
    req.flush(mockMessages);
  });

  it('should fetch group chat history', () => {
    const groupName = 'group1';
    const mockMessages = [{ sender: 'user1', message: 'Hello' }];

    service.getGroupChatHistory(groupName).subscribe(messages => {
      expect(messages).toEqual(mockMessages);
    });

    const req = httpMock.expectOne(`http://localhost:5000/chat/groups/messages/${encodeURIComponent(groupName)}`);
    expect(req.request.method).toBe('GET');
    req.flush(mockMessages);
  });

  it('should create a new group', () => {
    const groupData = { groupName: 'newGroup', admin: 'adminUser' };
    const mockResponse = { success: true };

    service.createGroup(groupData).subscribe(response => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne('http://localhost:5000/chat/groups/create');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(groupData);
    req.flush(mockResponse);
  });

  it('should add a user to a group', () => {
    const groupData = { groupName: 'group1', username: 'newUser' };
    const mockResponse = { success: true };

    service.addUserToGroup(groupData).subscribe(response => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne('http://localhost:5000/chat/groups/add-user');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(groupData);
    req.flush(mockResponse);
  });

  it('should mark messages as read', () => {
    const currentUser = 'user1';
    const sender = 'user2';
    const mockResponse = { success: true };

    service.markMessagesAsRead(currentUser, sender).subscribe(response => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`http://localhost:5000/chat/messages/read/${sender}/${currentUser}`);
    expect(req.request.method).toBe('PUT');
    req.flush(mockResponse);
  });

  it('should mark group messages as read', () => {
    const groupName = 'group1';
    const username = 'user1';
    const mockResponse = { success: true };

    service.markGroupMessagesAsRead(groupName, username).subscribe(response => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`http://localhost:5000/chat/groups/messages/read/${groupName}/${username}`);
    expect(req.request.method).toBe('PUT');
    req.flush(mockResponse);
  });

  it('should send a private message', () => {
    const receiver = 'user2';
    const message = 'Hello';
    jest.spyOn(service['socket'], 'emit');

    service.sendPrivateMessage(receiver, message);

    expect(service['socket'].emit).toHaveBeenCalledWith('send_private_message', {
      sender: service['currentUser'],
      receiver,
      message,
      timestamp: expect.any(Date)
    });
  });

  it('should send a group message', () => {
    const groupName = 'group1';
    const message = 'Hello Group';
    jest.spyOn(service['socket'], 'emit');

    service.sendGroupMessage(groupName, message);

    expect(service['socket'].emit).toHaveBeenCalledWith('send_group_message', {
      sender: service['currentUser'],
      group: groupName,
      message,
      timestamp: expect.any(Date),
      readBy: [service['currentUser']]
    });
  });

  it('should join and leave a group', () => {
    const groupName = 'group1';
    jest.spyOn(service['socket'], 'emit');

    service.joinGroup(groupName);
    expect(service['socket'].emit).toHaveBeenCalledWith('join_group', {
      group: groupName,
      user: service['currentUser']
    });

    service.leaveGroup(groupName);
    expect(service['socket'].emit).toHaveBeenCalledWith('leave_group', {
      group: groupName,
      user: service['currentUser']
    });
  });

  it('should emit typing status', () => {
    const receiver = 'user2';
    jest.spyOn(service['socket'], 'emit');

    service.emitTyping(receiver, true);
    expect(service['socket'].emit).toHaveBeenCalledWith('typing', {
      sender: service['currentUser'],
      receiver
    });

    service.emitTyping(receiver, false);
    expect(service['socket'].emit).toHaveBeenCalledWith('stop_typing', {
      sender: service['currentUser'],
      receiver
    });
  });

  it('should emit group typing status', () => {
    const groupName = 'group1';
    jest.spyOn(service['socket'], 'emit');

    service.emitGroupTyping(groupName, true);
    expect(service['socket'].emit).toHaveBeenCalledWith('typing_group', {
      sender: service['currentUser'],
      group: groupName
    });

    service.emitGroupTyping(groupName, false);
    expect(service['socket'].emit).toHaveBeenCalledWith('stop_typing_group', {
      sender: service['currentUser'],
      group: groupName
    });
  });

  it('should fetch unread message count', () => {
    const username = 'user1';
    const mockCount = { count: 5 };

    service.getUnreadMessageCount(username).subscribe(count => {
      expect(count).toEqual(mockCount);
    });

    const req = httpMock.expectOne(`http://localhost:5000/chat/messages/unread/${username}`);
    expect(req.request.method).toBe('GET');
    req.flush(mockCount);
  });

  it('should fetch group unread message count', () => {
    const groupName = 'group1';
    const username = 'user1';
    const mockCount = { count: 3 };

    service.getGroupUnreadCount(groupName, username).subscribe(count => {
      expect(count).toEqual(mockCount);
    });

    const req = httpMock.expectOne(`http://localhost:5000/chat/groups/unread/${groupName}/${username}`);
    expect(req.request.method).toBe('GET');
    req.flush(mockCount);
  });

  it('should disconnect the socket', () => {
    jest.spyOn(service['socket'], 'disconnect');
    service.disconnect();
    expect(service['socket'].disconnect).toHaveBeenCalled();
  });

  it('should update messages', () => {
    const messages = [{ sender: 'user1', message: 'Hello' }];
    service.updateMessages(messages);
    service.getMessages().subscribe(updatedMessages => {
      expect(updatedMessages).toEqual(messages);
    });
  });

  it('should handle socket connection', () => {
    service.initializeSocket('testUser');
    expect(mockSocket.on).toHaveBeenCalled();
  });

  it('should handle socket disconnection', () => {
    service.initializeSocket('testUser');
    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
  });


  it('should handle HTTP errors when getting users', () => {
    service.getUsers().subscribe({
      error: (error) => {
        expect(error.status).toBe(500);
      }
    });

    const req = httpMock.expectOne('http://localhost:5000/api/users');
    req.flush('Error', { status: 500, statusText: 'Server Error' });
  });

  it('should handle HTTP errors when getting groups', () => {
    const username = 'testUser';
    service.getGroups(username).subscribe({
      error: (error) => {
        expect(error.status).toBe(500);
      }
    });

    const req = httpMock.expectOne(`http://localhost:5000/chat/groups?username=${encodeURIComponent(username)}`);
    req.flush('Error', { status: 500, statusText: 'Server Error' });
  });

  it('should handle HTTP errors when getting chat history', () => {
    const user1 = 'user1';
    const user2 = 'user2';
    service.getChatHistory(user1, user2).subscribe({
      error: (error) => {
        expect(error.status).toBe(500);
      }
    });

    const req = httpMock.expectOne(`http://localhost:5000/chat/messages/${user1}/${user2}`);
    req.flush('Error', { status: 500, statusText: 'Server Error' });
  });

  it('should handle HTTP errors when getting group chat history', () => {
    const groupName = 'group1';
    service.getGroupChatHistory(groupName).subscribe({
      error: (error) => {
        expect(error.status).toBe(500);
      }
    });

    const req = httpMock.expectOne(`http://localhost:5000/chat/groups/messages/${encodeURIComponent(groupName)}`);
    req.flush('Error', { status: 500, statusText: 'Server Error' });
  });

  it('should handle HTTP errors when creating group', () => {
    const groupData = { groupName: 'newGroup', admin: 'adminUser' };
    service.createGroup(groupData).subscribe({
      error: (error) => {
        expect(error.status).toBe(500);
      }
    });

    const req = httpMock.expectOne('http://localhost:5000/chat/groups/create');
    req.flush('Error', { status: 500, statusText: 'Server Error' });
  });

  it('should handle HTTP errors when adding user to group', () => {
    const groupData = { groupName: 'group1', username: 'newUser' };
    service.addUserToGroup(groupData).subscribe({
      error: (error) => {
        expect(error.status).toBe(500);
      }
    });

    const req = httpMock.expectOne('http://localhost:5000/chat/groups/add-user');
    req.flush('Error', { status: 500, statusText: 'Server Error' });
  });

  it('should handle HTTP errors when marking messages as read', () => {
    const currentUser = 'user1';
    const sender = 'user2';
    service.markMessagesAsRead(currentUser, sender).subscribe({
      error: (error) => {
        expect(error.status).toBe(500);
      }
    });

    const req = httpMock.expectOne(`http://localhost:5000/chat/messages/read/${sender}/${currentUser}`);
    req.flush('Error', { status: 500, statusText: 'Server Error' });
  });

  it('should handle HTTP errors when marking group messages as read', () => {
    const groupName = 'group1';
    const username = 'user1';
    service.markGroupMessagesAsRead(groupName, username).subscribe({
      error: (error) => {
        expect(error.status).toBe(500);
      }
    });

    const req = httpMock.expectOne(`http://localhost:5000/chat/groups/messages/read/${groupName}/${username}`);
    req.flush('Error', { status: 500, statusText: 'Server Error' });
  });

  it('should handle socket connection errors', () => {
    service.initializeSocket('testUser');
    expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
  });

  it('should handle socket disconnection', () => {
    service.initializeSocket('testUser');
    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
  });


  it('should handle socket private message events', () => {
    service.initializeSocket('testUser');
    expect(mockSocket.on).toHaveBeenCalledWith('receive_private_message', expect.any(Function));
  });

  it('should handle socket group message events', () => {
    service.initializeSocket('testUser');
    expect(mockSocket.on).toHaveBeenCalledWith('receive_group_message', expect.any(Function));
  });
  it('should handle socket typing events', () => {
    service.initializeSocket('testUser');
    expect(mockSocket.on).toHaveBeenCalledWith('user_typing', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('userStoppedTyping', expect.any(Function));
  });

  it('should handle socket online users events', () => {
    service.initializeSocket('testUser');
    expect(mockSocket.on).toHaveBeenCalledWith('users_online', expect.any(Function));
  });

});
