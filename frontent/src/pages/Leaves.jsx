import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Heading,
  useToast,
  Spinner,
  Center,
  Text,
  SimpleGrid,
  Flex,
  Select,
  HStack,
  VStack,
  Card,
  CardBody,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  IconButton,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Textarea,
  Button,
  Avatar,
  Icon,
  Stat,
  StatLabel,
  StatNumber,
  StatGroup,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from '@chakra-ui/react';
import { FiCheckCircle, FiXCircle, FiClock, FiCalendar, FiUser, FiFileText, FiTrash2, FiDownload, FiPaperclip } from 'react-icons/fi';
import MainLayout from '../components/Layout/MainLayout';
import { leavesAPI, BASE_URL } from '../services/api';
import { useSocket } from '../hooks/useSocket';

const Leaves = () => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [reviewAction, setReviewAction] = useState(''); // 'approve' or 'reject'
  const [rejectionReason, setRejectionReason] = useState('');
  const [socketConnected, setSocketConnected] = useState(false);

  const { isOpen: isReviewOpen, onOpen: onReviewOpen, onClose: onReviewClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const toast = useToast();

  // Helper function to get full image URL
  const getProfileImageUrl = (profileImage) => {
    if (!profileImage) return null;
    if (profileImage.startsWith('http')) return profileImage;
    return `${BASE_URL}${profileImage}`;
  };

  // Helper function to get full attachment URL
  const getAttachmentUrl = (attachment) => {
    if (!attachment || !attachment.url) return null;
    if (attachment.url.startsWith('http')) return attachment.url;
    return `${BASE_URL}${attachment.url}`;
  };

  // Function to download PDF attachment
  const handleViewAttachment = async (attachment) => {
    const url = getAttachmentUrl(attachment);
    if (!url) return;

    try {
      // Get token from localStorage for authenticated requests
      const token = localStorage.getItem('adminToken');
      
      // Fetch the file as a blob with authentication
      const headers = {};
      if (token && token !== 'admin-authenticated') {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers: headers,
        credentials: 'include', // Include cookies if any
      });
      
      if (!response.ok) {
        throw new Error('فشل تحميل الملف');
      }
      
      const blob = await response.blob();
      
      // Check if browser supports download attribute properly
      // Create blob URL
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = attachment.filename || 'attachment.pdf';
      link.style.display = 'none';
      
      // Force download by setting both download attribute and using a data URL approach
      document.body.appendChild(link);
      
      // Trigger click immediately
      link.click();
      
      // Clean up after a short delay
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }, 100);
      
      // Show success message
      toast({
        title: 'تم التحميل',
        description: 'جاري تحميل الملف...',
        status: 'success',
        duration: 2000,
      });
      
    } catch (error) {
      console.error('Error downloading attachment:', error);
      toast({
        title: 'خطأ',
        description: 'فشل تحميل الملف. جاري فتحه في نافذة جديدة...',
        status: 'warning',
        duration: 3000,
      });
      // Fallback: open in new tab if download fails
      window.open(url, '_blank');
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, [filterStatus, filterType, filterYear]);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterType) params.type = filterType;
      if (filterYear) params.year = filterYear;

      const data = await leavesAPI.getAll(params);
      setLeaves(data.leaves || []);
    } catch (error) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل تحميل الإجازات',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReview = (leave, action) => {
    setSelectedLeave(leave);
    setReviewAction(action);
    setRejectionReason('');
    onReviewOpen();
  };

  const handleReview = async () => {
    try {
      if (reviewAction === 'reject' && !rejectionReason.trim()) {
        toast({
          title: 'خطأ',
          description: 'الرجاء إدخال سبب الرفض',
          status: 'error',
          duration: 3000,
        });
        return;
      }

      await leavesAPI.review(selectedLeave._id, {
        status: reviewAction === 'approve' ? 'approved' : 'rejected',
        rejectionReason: reviewAction === 'reject' ? rejectionReason : undefined,
      });

      toast({
        title: 'تم بنجاح',
        description: reviewAction === 'approve' ? 'تمت الموافقة على الطلب' : 'تم رفض الطلب',
        status: 'success',
        duration: 3000,
      });

      onReviewClose();
      fetchLeaves();
    } catch (error) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء المراجعة',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleOpenDelete = (leave) => {
    setSelectedLeave(leave);
    onDeleteOpen();
  };

  const handleDeleteLeave = async () => {
    try {
      await leavesAPI.delete(selectedLeave._id);
      toast({
        title: 'تم الحذف',
        description: 'تم حذف طلب الإجازة بنجاح',
        status: 'success',
        duration: 3000,
      });
      onDeleteClose();
      fetchLeaves();
    } catch (error) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل حذف طلب الإجازة',
        status: 'error',
        duration: 3000,
      });
    }
  };

  // Socket.io real-time event handlers
  const handleLeaveCreatedRealtime = useCallback((newLeave) => {
    console.log('📬 Real-time: New leave request received', newLeave);
    setLeaves(prev => [newLeave, ...prev]);
    toast({
      title: 'طلب إجازة جديد',
      description: `تلقيت طلب إجازة جديد من ${newLeave.user?.fullName}`,
      status: 'info',
      duration: 5000,
      isClosable: true,
    });
  }, [toast]);

  const handleLeaveReviewedRealtime = useCallback((reviewedLeave) => {
    console.log('🔄 Real-time: Leave reviewed', reviewedLeave);
    setLeaves(prev => 
      prev.map(l => l._id === reviewedLeave._id ? reviewedLeave : l)
    );
  }, []);

  // Memoize Socket.io event handlers
  const socketEventHandlers = React.useMemo(() => ({
    'leaveCreated': handleLeaveCreatedRealtime,
    'leaveReviewed': handleLeaveReviewedRealtime,
  }), [handleLeaveCreatedRealtime, handleLeaveReviewedRealtime]);

  // Connect to Socket.io for real-time updates
  useSocket(
    () => {
      console.log('✅ Admin panel connected to Socket.io for leave updates');
      setSocketConnected(true);
    },
    () => {
      console.log('❌ Admin panel disconnected from Socket.io');
      setSocketConnected(false);
    },
    socketEventHandlers
  );

  const getTypeLabel = (type) => {
    const types = {
      annual: { label: 'سنوية', color: 'blue', icon: FiCalendar },
      sick: { label: 'مرضية', color: 'red', icon: FiFileText },
      emergency: { label: 'طارئة', color: 'orange', icon: FiClock },
      unpaid: { label: 'بدون راتب', color: 'gray', icon: FiFileText },
      'half-day': { label: 'نصف يوم', color: 'purple', icon: FiClock }
    };
    return types[type] || types.annual;
  };

  const getStatusLabel = (status) => {
    const statuses = {
      pending: { label: 'قيد المراجعة', color: 'yellow' },
      approved: { label: 'موافق عليها', color: 'green' },
      rejected: { label: 'مرفوضة', color: 'red' },
      cancelled: { label: 'ملغاة', color: 'gray' }
    };
    return statuses[status] || statuses.pending;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-JO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

  // Calculate statistics
  const stats = {
    total: leaves.length,
    pending: leaves.filter(l => l.status === 'pending').length,
    approved: leaves.filter(l => l.status === 'approved').length,
    rejected: leaves.filter(l => l.status === 'rejected').length,
  };

  // Separate pending and reviewed leaves
  const pendingLeaves = leaves.filter(l => l.status === 'pending');
  const reviewedLeaves = leaves.filter(l => l.status !== 'pending');

  return (
    <MainLayout>
      <Box p={8} w="100%" maxW="100%" overflowX="hidden" boxSizing="border-box">
        <HStack justify="space-between" mb={6}>
          <HStack spacing={4}>
            <Heading size="lg">إدارة الإجازات الشخصية</Heading>
            {socketConnected && (
              <Badge colorScheme="green" fontSize="xs" px={2} py={1} borderRadius="md">
                🔴 مباشر
              </Badge>
            )}
          </HStack>
        </HStack>

        {/* Statistics */}
        <StatGroup mb={6}>
          <Card flex="1">
            <CardBody>
              <Stat>
                <StatLabel>إجمالي الطلبات</StatLabel>
                <StatNumber>{stats.total}</StatNumber>
              </Stat>
            </CardBody>
          </Card>
          <Card flex="1">
            <CardBody>
              <Stat>
                <StatLabel>قيد المراجعة</StatLabel>
                <StatNumber color="orange.500">{stats.pending}</StatNumber>
              </Stat>
            </CardBody>
          </Card>
          <Card flex="1">
            <CardBody>
              <Stat>
                <StatLabel>موافق عليها</StatLabel>
                <StatNumber color="green.500">{stats.approved}</StatNumber>
              </Stat>
            </CardBody>
          </Card>
          <Card flex="1">
            <CardBody>
              <Stat>
                <StatLabel>مرفوضة</StatLabel>
                <StatNumber color="red.500">{stats.rejected}</StatNumber>
              </Stat>
            </CardBody>
          </Card>
        </StatGroup>

        {/* Filters */}
        <Card mb={6}>
          <CardBody>
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
              <FormControl>
                <FormLabel>السنة</FormLabel>
                <Select value={filterYear} onChange={(e) => setFilterYear(parseInt(e.target.value))}>
                  {years.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>الحالة</FormLabel>
                <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                  <option value="">الكل</option>
                  <option value="pending">قيد المراجعة</option>
                  <option value="approved">موافق عليها</option>
                  <option value="rejected">مرفوضة</option>
                  <option value="cancelled">ملغاة</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>النوع</FormLabel>
                <Select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                  <option value="">الكل</option>
                  <option value="annual">سنوية</option>
                  <option value="sick">مرضية</option>
                  <option value="emergency">طارئة</option>
                  <option value="unpaid">بدون راتب</option>
                  <option value="half-day">نصف يوم</option>
                </Select>
              </FormControl>
            </SimpleGrid>
          </CardBody>
        </Card>

        {/* Tabs for Pending and Reviewed */}
        <Tabs variant="enclosed">
          <TabList>
            <Tab>
              <Icon as={FiClock} mr={2} />
              قيد المراجعة ({stats.pending})
            </Tab>
            <Tab>
              <Icon as={FiFileText} mr={2} />
              تمت المراجعة ({stats.approved + stats.rejected})
            </Tab>
          </TabList>

          <TabPanels>
            {/* Pending Leaves */}
            <TabPanel p={0} pt={6}>
              <Card>
                <CardBody>
                  {loading ? (
                    <Center py={10}>
                      <Spinner size="xl" color="blue.500" />
                    </Center>
                  ) : pendingLeaves.length === 0 ? (
                    <Center py={10}>
                      <VStack spacing={4}>
                        <Icon as={FiCheckCircle} boxSize={16} color="gray.300" />
                        <Text color="gray.500">لا توجد طلبات قيد المراجعة</Text>
                      </VStack>
                    </Center>
                  ) : (
                    <Box overflowX="auto">
                      <Table variant="simple">
                        <Thead>
                          <Tr>
                            <Th>الموظف</Th>
                            <Th>النوع</Th>
                            <Th>من - إلى</Th>
                            <Th>الأيام</Th>
                            <Th>السبب</Th>
                            <Th>المرفقات</Th>
                            <Th>تاريخ الطلب</Th>
                            <Th>الإجراءات</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {pendingLeaves.map((leave) => {
                            const typeInfo = getTypeLabel(leave.type);
                            const user = typeof leave.user === 'object' ? leave.user : null;

                            return (
                              <Tr key={leave._id} bg="orange.50">
                                <Td>
                                  <HStack>
                                    <Avatar
                                      size="sm"
                                      name={user?.fullName || 'User'}
                                      src={getProfileImageUrl(user?.profileImage)}
                                    />
                                    <VStack align="start" spacing={0}>
                                      <Text fontWeight="bold" fontSize="sm">
                                        {user?.fullName || 'N/A'}
                                      </Text>
                                      <Text fontSize="xs" color="gray.600">
                                        {user?.employeeNumber || 'N/A'}
                                      </Text>
                                    </VStack>
                                  </HStack>
                                </Td>
                                <Td>
                                  <Badge colorScheme={typeInfo.color}>
                                    {typeInfo.label}
                                  </Badge>
                                </Td>
                                <Td>
                                  <VStack align="start" spacing={1}>
                                    <Text fontSize="sm">{formatDate(leave.startDate)}</Text>
                                    <Text fontSize="sm">{formatDate(leave.endDate)}</Text>
                                  </VStack>
                                </Td>
                                <Td>
                                  <Badge colorScheme="purple">{leave.days} يوم</Badge>
                                </Td>
                                <Td>
                                  <Text fontSize="sm" maxW="200px" noOfLines={2}>
                                    {leave.reason}
                                  </Text>
                                </Td>
                                <Td>
                                  {leave.attachments && leave.attachments.length > 0 ? (
                                    <HStack spacing={2}>
                                      {leave.attachments.map((attachment, index) => (
                                        <IconButton
                                          key={index}
                                          icon={<FiDownload />}
                                          size="sm"
                                          colorScheme="blue"
                                          variant="outline"
                                          onClick={() => handleViewAttachment(attachment)}
                                          aria-label={`عرض المرفق ${attachment.filename || index + 1}`}
                                          title={attachment.filename || 'عرض المرفق'}
                                        />
                                      ))}
                                    </HStack>
                                  ) : (
                                    <Text fontSize="sm" color="gray.400">
                                      لا يوجد
                                    </Text>
                                  )}
                                </Td>
                                <Td>
                                  <Text fontSize="sm" color="gray.600">
                                    {formatDate(leave.createdAt)}
                                  </Text>
                                </Td>
                                <Td>
                                  <HStack spacing={2}>
                                    <IconButton
                                      icon={<FiCheckCircle />}
                                      size="sm"
                                      colorScheme="green"
                                      onClick={() => handleOpenReview(leave, 'approve')}
                                      aria-label="موافقة"
                                    />
                                    <IconButton
                                      icon={<FiXCircle />}
                                      size="sm"
                                      colorScheme="red"
                                      onClick={() => handleOpenReview(leave, 'reject')}
                                      aria-label="رفض"
                                    />
                                  </HStack>
                                </Td>
                              </Tr>
                            );
                          })}
                        </Tbody>
                      </Table>
                    </Box>
                  )}
                </CardBody>
              </Card>
            </TabPanel>

            {/* Reviewed Leaves */}
            <TabPanel p={0} pt={6}>
              <Card>
                <CardBody>
                  {loading ? (
                    <Center py={10}>
                      <Spinner size="xl" color="blue.500" />
                    </Center>
                  ) : reviewedLeaves.length === 0 ? (
                    <Center py={10}>
                      <VStack spacing={4}>
                        <Icon as={FiFileText} boxSize={16} color="gray.300" />
                        <Text color="gray.500">لا توجد طلبات تمت مراجعتها</Text>
                      </VStack>
                    </Center>
                  ) : (
                    <Box overflowX="auto">
                      <Table variant="simple">
                        <Thead>
                          <Tr>
                            <Th>الموظف</Th>
                            <Th>النوع</Th>
                            <Th>من - إلى</Th>
                            <Th>الأيام</Th>
                            <Th>السبب</Th>
                            <Th>المرفقات</Th>
                            <Th>الحالة</Th>
                            <Th>المراجع</Th>
                            <Th>تاريخ المراجعة</Th>
                            <Th>الإجراءات</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {reviewedLeaves.map((leave) => {
                            const typeInfo = getTypeLabel(leave.type);
                            const statusInfo = getStatusLabel(leave.status);
                            const user = typeof leave.user === 'object' ? leave.user : null;
                            const reviewer = typeof leave.reviewedBy === 'object' ? leave.reviewedBy : null;

                            return (
                              <Tr key={leave._id}>
                                <Td>
                                  <HStack>
                                    <Avatar
                                      size="sm"
                                      name={user?.fullName || 'User'}
                                      src={getProfileImageUrl(user?.profileImage)}
                                    />
                                    <VStack align="start" spacing={0}>
                                      <Text fontWeight="bold" fontSize="sm">
                                        {user?.fullName || 'N/A'}
                                      </Text>
                                      <Text fontSize="xs" color="gray.600">
                                        {user?.employeeNumber || 'N/A'}
                                      </Text>
                                    </VStack>
                                  </HStack>
                                </Td>
                                <Td>
                                  <Badge colorScheme={typeInfo.color}>
                                    {typeInfo.label}
                                  </Badge>
                                </Td>
                                <Td>
                                  <VStack align="start" spacing={1}>
                                    <Text fontSize="sm">{formatDate(leave.startDate)}</Text>
                                    <Text fontSize="sm">{formatDate(leave.endDate)}</Text>
                                  </VStack>
                                </Td>
                                <Td>
                                  <Badge colorScheme="purple">{leave.days} يوم</Badge>
                                </Td>
                                <Td>
                                  <VStack align="start" spacing={1}>
                                    <Text fontSize="sm" maxW="200px" noOfLines={2}>
                                      {leave.reason}
                                    </Text>
                                    {leave.status === 'rejected' && leave.rejectionReason && (
                                      <Text fontSize="xs" color="red.600" fontWeight="bold">
                                        سبب الرفض: {leave.rejectionReason}
                                      </Text>
                                    )}
                                  </VStack>
                                </Td>
                                <Td>
                                  {leave.attachments && leave.attachments.length > 0 ? (
                                    <HStack spacing={2}>
                                      {leave.attachments.map((attachment, index) => (
                                        <IconButton
                                          key={index}
                                          icon={<FiDownload />}
                                          size="sm"
                                          colorScheme="blue"
                                          variant="outline"
                                          onClick={() => handleViewAttachment(attachment)}
                                          aria-label={`عرض المرفق ${attachment.filename || index + 1}`}
                                          title={attachment.filename || 'عرض المرفق'}
                                        />
                                      ))}
                                    </HStack>
                                  ) : (
                                    <Text fontSize="sm" color="gray.400">
                                      لا يوجد
                                    </Text>
                                  )}
                                </Td>
                                <Td>
                                  <Badge colorScheme={statusInfo.color}>
                                    {statusInfo.label}
                                  </Badge>
                                </Td>
                                <Td>
                                  <Text fontSize="sm" color="gray.600">
                                    {reviewer?.fullName || 'N/A'}
                                  </Text>
                                </Td>
                                <Td>
                                  <Text fontSize="sm" color="gray.600">
                                    {leave.reviewedAt ? formatDate(leave.reviewedAt) : 'N/A'}
                                  </Text>
                                </Td>
                                <Td>
                                  <IconButton
                                    icon={<FiTrash2 />}
                                    size="sm"
                                    colorScheme="red"
                                    variant="ghost"
                                    onClick={() => handleOpenDelete(leave)}
                                    aria-label="حذف"
                                  />
                                </Td>
                              </Tr>
                            );
                          })}
                        </Tbody>
                      </Table>
                    </Box>
                  )}
                </CardBody>
              </Card>
            </TabPanel>
          </TabPanels>
        </Tabs>

        {/* Review Modal */}
        <Modal isOpen={isReviewOpen} onClose={onReviewClose} size="lg">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>
              {reviewAction === 'approve' ? 'الموافقة على الطلب' : 'رفض الطلب'}
            </ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              {selectedLeave && (
                <VStack spacing={4} align="stretch">
                  <HStack>
                    <Avatar
                      size="md"
                      name={selectedLeave.user?.fullName || 'User'}
                      src={getProfileImageUrl(selectedLeave.user?.profileImage)}
                    />
                    <VStack align="start" spacing={0}>
                      <Text fontWeight="bold">{selectedLeave.user?.fullName}</Text>
                      <Text fontSize="sm" color="gray.600">
                        {selectedLeave.user?.employeeNumber}
                      </Text>
                    </VStack>
                  </HStack>

                  <Box p={4} bg="gray.50" borderRadius="md">
                    <VStack align="stretch" spacing={2}>
                      <HStack justify="space-between">
                        <Text fontSize="sm" fontWeight="bold">النوع:</Text>
                        <Badge colorScheme={getTypeLabel(selectedLeave.type).color}>
                          {getTypeLabel(selectedLeave.type).label}
                        </Badge>
                      </HStack>
                      <HStack justify="space-between">
                        <Text fontSize="sm" fontWeight="bold">المدة:</Text>
                        <Text fontSize="sm">{selectedLeave.days} يوم</Text>
                      </HStack>
                      <HStack justify="space-between">
                        <Text fontSize="sm" fontWeight="bold">من:</Text>
                        <Text fontSize="sm">{formatDate(selectedLeave.startDate)}</Text>
                      </HStack>
                      <HStack justify="space-between">
                        <Text fontSize="sm" fontWeight="bold">إلى:</Text>
                        <Text fontSize="sm">{formatDate(selectedLeave.endDate)}</Text>
                      </HStack>
                      <Box>
                        <Text fontSize="sm" fontWeight="bold" mb={1}>السبب:</Text>
                        <Text fontSize="sm" color="gray.600">
                          {selectedLeave.reason}
                        </Text>
                      </Box>
                      {selectedLeave.attachments && selectedLeave.attachments.length > 0 && (
                        <Box>
                          <Text fontSize="sm" fontWeight="bold" mb={2}>المرفقات:</Text>
                          <VStack align="stretch" spacing={2}>
                            {selectedLeave.attachments.map((attachment, index) => (
                              <HStack
                                key={index}
                                p={2}
                                bg="blue.50"
                                borderRadius="md"
                                justify="space-between"
                              >
                                <HStack>
                                  <Icon as={FiPaperclip} color="blue.500" />
                                  <Text fontSize="sm" color="gray.700">
                                    {attachment.filename || `مرفق ${index + 1}`}
                                  </Text>
                                </HStack>
                                <Button
                                  size="sm"
                                  leftIcon={<FiDownload />}
                                  colorScheme="blue"
                                  variant="outline"
                                  onClick={() => handleViewAttachment(attachment)}
                                >
                                  عرض
                                </Button>
                              </HStack>
                            ))}
                          </VStack>
                        </Box>
                      )}
                    </VStack>
                  </Box>

                  {reviewAction === 'reject' && (
                    <FormControl isRequired>
                      <FormLabel>سبب الرفض</FormLabel>
                      <Textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="الرجاء إدخال سبب رفض الطلب..."
                        rows={4}
                      />
                    </FormControl>
                  )}

                  <Text fontSize="sm" color="gray.500" textAlign="center">
                    {reviewAction === 'approve'
                      ? 'هل أنت متأكد من الموافقة على هذا الطلب؟'
                      : 'سيتم إشعار الموظف برفض الطلب والسبب'}
                  </Text>
                </VStack>
              )}
            </ModalBody>

            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={onReviewClose}>
                إلغاء
              </Button>
              <Button
                colorScheme={reviewAction === 'approve' ? 'green' : 'red'}
                onClick={handleReview}
              >
                {reviewAction === 'approve' ? 'موافقة' : 'رفض'}
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal isOpen={isDeleteOpen} onClose={onDeleteClose}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>تأكيد الحذف</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              {selectedLeave && (
                <VStack spacing={4} align="stretch">
                  <Text>
                    هل أنت متأكد من حذف طلب الإجازة الخاص بـ{' '}
                    <strong>{selectedLeave.user?.fullName || 'الموظف'}</strong>؟
                  </Text>
                  <Box p={4} bg="gray.50" borderRadius="md">
                    <VStack align="start" spacing={2}>
                      <Text fontSize="sm">
                        <strong>النوع:</strong> {getTypeLabel(selectedLeave.type).label}
                      </Text>
                      <Text fontSize="sm">
                        <strong>المدة:</strong> {selectedLeave.days} يوم
                      </Text>
                      <Text fontSize="sm">
                        <strong>من:</strong> {formatDate(selectedLeave.startDate)}
                      </Text>
                      <Text fontSize="sm">
                        <strong>إلى:</strong> {formatDate(selectedLeave.endDate)}
                      </Text>
                      <Text fontSize="sm">
                        <strong>السبب:</strong> {selectedLeave.reason}
                      </Text>
                    </VStack>
                  </Box>
                  <Text fontSize="sm" color="red.500" fontWeight="bold">
                    ⚠️ تحذير: لا يمكن التراجع عن هذا الإجراء
                  </Text>
                </VStack>
              )}
            </ModalBody>

            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={onDeleteClose}>
                إلغاء
              </Button>
              <Button colorScheme="red" onClick={handleDeleteLeave}>
                حذف
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </Box>
    </MainLayout>
  );
};

export default Leaves;

